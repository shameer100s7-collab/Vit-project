"""Portfolio and asset allocation repository."""

from typing import List, Optional
from uuid import UUID
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models.portfolio import Portfolio, PortfolioAsset
from app.db.repositories.base import BaseRepository


class PortfolioRepository(BaseRepository[Portfolio]):
    """Repository managing Portfolio and associated holdings."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Portfolio, session)

    async def get_by_user(self, user_id: UUID) -> List[Portfolio]:
        """Finds all portfolios owned by a specific user."""
        query = select(Portfolio).where(Portfolio.user_id == user_id)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_with_assets(self, portfolio_id: UUID) -> Optional[Portfolio]:
        """Finds a portfolio and eagerly loads all underlying assets."""
        query = (
            select(Portfolio)
            .where(Portfolio.id == portfolio_id)
            .options(selectinload(Portfolio.assets))
        )
        result = await self.session.execute(query)
        return result.scalars().first()

    async def add_asset(
        self,
        portfolio_id: UUID,
        symbol: str,
        target_weight: float = 0.0,
        current_weight: float = 0.0,
        quantity: float = 0.0,
        avg_entry_price: float = 0.0,
    ) -> PortfolioAsset:
        """Adds a new asset allocation record to the specified portfolio."""
        asset = PortfolioAsset(
            portfolio_id=portfolio_id,
            symbol=symbol.upper().strip(),
            target_weight=target_weight,
            current_weight=current_weight,
            quantity=quantity,
            avg_entry_price=avg_entry_price,
        )
        self.session.add(asset)
        await self.session.flush()
        await self.session.refresh(asset)
        return asset
