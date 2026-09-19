"""Portfolio service providing business logic for real asset tracking and wallet integration."""

import uuid
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import GHOSTException, NotFoundException
from app.db.models.portfolio import Portfolio, PortfolioAsset, Wallet
from app.schemas.portfolio import AddAssetRequest, AddWalletRequest, UpdateAssetRequest
from app.services.wallet_provider import wallet_provider


class PortfolioService:
    """Service managing user portfolios, manual holdings, and read-only public wallets."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_or_create_portfolio(self, user_id: uuid.UUID) -> Portfolio:
        """Retrieves user's primary portfolio or creates an initial one if missing."""
        query = (
            select(Portfolio)
            .where(Portfolio.user_id == user_id)
            .options(selectinload(Portfolio.assets), selectinload(Portfolio.wallets))
        )
        result = await self.session.execute(query)
        portfolio = result.scalars().first()

        if not portfolio:
            portfolio = Portfolio(
                user_id=user_id,
                name="Core Portfolio",
                currency="USD",
            )
            self.session.add(portfolio)
            await self.session.flush()

            # Re-fetch with relationships loaded
            result = await self.session.execute(
                select(Portfolio)
                .where(Portfolio.id == portfolio.id)
                .options(selectinload(Portfolio.assets), selectinload(Portfolio.wallets))
            )
            portfolio = result.scalars().first()

        return portfolio

    async def add_manual_asset(self, user_id: uuid.UUID, payload: AddAssetRequest) -> PortfolioAsset:
        """Adds or updates a manual asset holding in the user's portfolio."""
        portfolio = await self.get_or_create_portfolio(user_id)
        sym = payload.symbol.upper().strip()

        # Check for existing manual holding for same symbol
        existing = next((a for a in portfolio.assets if a.symbol == sym and a.source == "Manual"), None)
        if existing:
            existing.quantity = payload.quantity
            if payload.avg_entry_price is not None:
                existing.avg_entry_price = payload.avg_entry_price
            if payload.network:
                existing.network = payload.network
            await self.session.flush()
            return existing

        new_asset = PortfolioAsset(
            portfolio_id=portfolio.id,
            symbol=sym,
            quantity=payload.quantity,
            avg_entry_price=payload.avg_entry_price or 0.0,
            source="Manual",
            network=payload.network or "Manual",
        )
        self.session.add(new_asset)
        await self.session.flush()
        return new_asset

    async def update_asset(self, user_id: uuid.UUID, asset_id: uuid.UUID, payload: UpdateAssetRequest) -> PortfolioAsset:
        """Updates quantity and entry price of an existing asset."""
        portfolio = await self.get_or_create_portfolio(user_id)
        asset = next((a for a in portfolio.assets if a.id == asset_id), None)
        if not asset:
            raise NotFoundException(f"Asset holding '{asset_id}' not found in your portfolio.")

        asset.quantity = payload.quantity
        if payload.avg_entry_price is not None:
            asset.avg_entry_price = payload.avg_entry_price
        await self.session.flush()
        return asset

    async def remove_asset(self, user_id: uuid.UUID, asset_id: uuid.UUID) -> None:
        """Removes an asset holding from user's portfolio."""
        portfolio = await self.get_or_create_portfolio(user_id)
        asset = next((a for a in portfolio.assets if a.id == asset_id), None)
        if not asset:
            raise NotFoundException(f"Asset holding '{asset_id}' not found in your portfolio.")

        await self.session.delete(asset)
        await self.session.flush()

    async def add_wallet(self, user_id: uuid.UUID, payload: AddWalletRequest) -> Wallet:
        """Verifies public address, fetches live blockchain balances, and saves wallet + detected assets."""
        portfolio = await self.get_or_create_portfolio(user_id)

        # Validate address format & network support
        clean_addr = wallet_provider.validate_address(payload.address, payload.network)
        net = payload.network.capitalize()

        # Check for duplicate wallet address in user portfolio
        existing_wallet = next((w for w in portfolio.wallets if w.address.lower() == clean_addr.lower() and w.network.lower() == net.lower()), None)
        if existing_wallet:
            raise GHOSTException("This wallet address is already connected to your portfolio.", code="DUPLICATE_WALLET")

        # Create wallet record
        new_wallet = Wallet(
            portfolio_id=portfolio.id,
            address=clean_addr,
            network=net,
            label=payload.label or f"{net} Wallet",
        )
        self.session.add(new_wallet)
        await self.session.flush()

        # Fetch live balances from blockchain RPC/API
        detected_assets = await wallet_provider.fetch_balances(clean_addr, net)

        # Add detected assets to database connected to this wallet
        for da in detected_assets:
            if da.quantity > 0:
                asset_record = PortfolioAsset(
                    portfolio_id=portfolio.id,
                    wallet_id=new_wallet.id,
                    symbol=da.symbol,
                    quantity=da.quantity,
                    source="Wallet",
                    network=net,
                )
                self.session.add(asset_record)

        await self.session.flush()
        return new_wallet

    async def remove_wallet(self, user_id: uuid.UUID, wallet_id: uuid.UUID) -> None:
        """Removes a connected wallet and its associated wallet assets."""
        portfolio = await self.get_or_create_portfolio(user_id)
        wallet = next((w for w in portfolio.wallets if w.id == wallet_id), None)
        if not wallet:
            raise NotFoundException(f"Wallet '{wallet_id}' not found in your portfolio.")

        await self.session.delete(wallet)
        await self.session.flush()

    async def refresh_wallet_balances(self, user_id: uuid.UUID, wallet_id: uuid.UUID) -> Wallet:
        """Refreshes live blockchain balances for a specific connected wallet."""
        portfolio = await self.get_or_create_portfolio(user_id)
        wallet = next((w for w in portfolio.wallets if w.id == wallet_id), None)
        if not wallet:
            raise NotFoundException(f"Wallet '{wallet_id}' not found in your portfolio.")

        # Fetch fresh balances from blockchain
        detected = await wallet_provider.fetch_balances(wallet.address, wallet.network)

        # Update existing wallet assets or create new ones
        wallet_assets = [a for a in portfolio.assets if a.wallet_id == wallet.id]
        detected_map = {d.symbol.upper(): d.quantity for d in detected}

        for asset in wallet_assets:
            if asset.symbol in detected_map:
                asset.quantity = detected_map.pop(asset.symbol)

        # Add newly detected symbols
        for sym, qty in detected_map.items():
            if qty > 0:
                new_asset = PortfolioAsset(
                    portfolio_id=portfolio.id,
                    wallet_id=wallet.id,
                    symbol=sym,
                    quantity=qty,
                    source="Wallet",
                    network=wallet.network,
                )
                self.session.add(new_asset)

        await self.session.flush()
        return wallet

    async def refresh_all_wallets(self, user_id: uuid.UUID) -> Portfolio:
        """Refreshes all connected wallets in user portfolio."""
        portfolio = await self.get_or_create_portfolio(user_id)
        for w in portfolio.wallets:
            try:
                await self.refresh_wallet_balances(user_id, w.id)
            except Exception:
                pass
        return portfolio
