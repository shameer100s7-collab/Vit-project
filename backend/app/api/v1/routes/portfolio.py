"""Portfolio and read-only wallet management endpoints."""

import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_active_user, get_request_id
from app.db.database import get_db
from app.db.models.user import User
from app.schemas.common import StandardSuccessResponse
from app.schemas.portfolio import (
    AddAssetRequest,
    AddWalletRequest,
    PortfolioAssetResponse,
    PortfolioResponse,
    UpdateAssetRequest,
    WalletResponse,
)
from app.services.portfolio import PortfolioService

router = APIRouter()


@router.get(
    "/me",
    response_model=StandardSuccessResponse[PortfolioResponse],
    summary="User Portfolio Overview",
    description="Returns authenticated user's portfolio, including manual holdings and connected public wallets.",
)
async def get_my_portfolio(
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[PortfolioResponse]:
    """Retrieves or creates user portfolio."""
    service = PortfolioService(session)
    portfolio = await service.get_or_create_portfolio(current_user.id)

    # Compute asset count per wallet for response
    wallet_responses = []
    for w in portfolio.wallets:
        asset_count = len([a for a in portfolio.assets if a.wallet_id == w.id])
        w_resp = WalletResponse.model_validate(w)
        w_resp.asset_count = asset_count
        wallet_responses.append(w_resp)

    resp = PortfolioResponse(
        id=portfolio.id,
        name=portfolio.name,
        currency=portfolio.currency,
        assets=[PortfolioAssetResponse.model_validate(a) for a in portfolio.assets],
        wallets=wallet_responses,
        updated_at=portfolio.updated_at,
    )

    return StandardSuccessResponse(
        success=True,
        data=resp,
        metadata={"request_id": request_id},
    )


@router.get(
    "/balances",
    response_model=StandardSuccessResponse[List[Dict[str, Any]]],
    summary="User Balances Overview",
    description="Returns high-level asset symbols and quantities for portfolio compatibility.",
)
async def get_my_balances(
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[List[Dict[str, Any]]]:
    """Aggregates portfolio holdings into simple balance items."""
    service = PortfolioService(session)
    portfolio = await service.get_or_create_portfolio(current_user.id)

    # Aggregate quantities by symbol across all sources (wallets & manual)
    agg: Dict[str, float] = {}
    for a in portfolio.assets:
        sym = a.symbol.upper()
        agg[sym] = agg.get(sym, 0.0) + a.quantity

    balances_list = [{"symbol": sym, "quantity": qty} for sym, qty in agg.items()]

    return StandardSuccessResponse(
        success=True,
        data=balances_list,
        metadata={"request_id": request_id},
    )


@router.post(
    "/assets",
    response_model=StandardSuccessResponse[PortfolioAssetResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Add Manual Asset",
    description="Adds or updates a manual holding in user portfolio.",
)
async def add_asset(
    payload: AddAssetRequest,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[PortfolioAssetResponse]:
    """Adds manual asset holding."""
    service = PortfolioService(session)
    asset = await service.add_manual_asset(current_user.id, payload)
    return StandardSuccessResponse(
        success=True,
        data=PortfolioAssetResponse.model_validate(asset),
        metadata={"request_id": request_id},
    )


@router.put(
    "/assets/{asset_id}",
    response_model=StandardSuccessResponse[PortfolioAssetResponse],
    summary="Update Asset Holding",
    description="Updates quantity or entry price of an existing asset holding.",
)
async def update_asset(
    asset_id: uuid.UUID,
    payload: UpdateAssetRequest,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[PortfolioAssetResponse]:
    """Updates asset holding."""
    service = PortfolioService(session)
    asset = await service.update_asset(current_user.id, asset_id, payload)
    return StandardSuccessResponse(
        success=True,
        data=PortfolioAssetResponse.model_validate(asset),
        metadata={"request_id": request_id},
    )


@router.delete(
    "/assets/{asset_id}",
    response_model=StandardSuccessResponse[Dict[str, str]],
    summary="Remove Asset Holding",
    description="Removes an asset holding from user portfolio.",
)
async def remove_asset(
    asset_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[Dict[str, str]]:
    """Removes asset holding."""
    service = PortfolioService(session)
    await service.remove_asset(current_user.id, asset_id)
    return StandardSuccessResponse(
        success=True,
        data={"message": "Asset removed successfully."},
        metadata={"request_id": request_id},
    )


@router.post(
    "/wallets",
    response_model=StandardSuccessResponse[WalletResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Connect Public Wallet",
    description="Verifies public address, queries live blockchain balances, and tracks detected assets.",
)
async def add_wallet(
    payload: AddWalletRequest,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[WalletResponse]:
    """Connects public wallet for read-only tracking."""
    service = PortfolioService(session)
    wallet = await service.add_wallet(current_user.id, payload)
    return StandardSuccessResponse(
        success=True,
        data=WalletResponse.model_validate(wallet),
        metadata={"request_id": request_id},
    )


@router.delete(
    "/wallets/{wallet_id}",
    response_model=StandardSuccessResponse[Dict[str, str]],
    summary="Remove Public Wallet",
    description="Disconnects a public wallet and removes its detected assets.",
)
async def remove_wallet(
    wallet_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[Dict[str, str]]:
    """Removes public wallet."""
    service = PortfolioService(session)
    await service.remove_wallet(current_user.id, wallet_id)
    return StandardSuccessResponse(
        success=True,
        data={"message": "Wallet removed successfully."},
        metadata={"request_id": request_id},
    )


@router.post(
    "/wallets/{wallet_id}/refresh",
    response_model=StandardSuccessResponse[WalletResponse],
    summary="Refresh Specific Wallet Balances",
    description="Fetches latest balances from blockchain for a connected public wallet.",
)
async def refresh_wallet(
    wallet_id: uuid.UUID,
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[WalletResponse]:
    """Refreshes wallet balances."""
    service = PortfolioService(session)
    wallet = await service.refresh_wallet_balances(current_user.id, wallet_id)
    return StandardSuccessResponse(
        success=True,
        data=WalletResponse.model_validate(wallet),
        metadata={"request_id": request_id},
    )


@router.post(
    "/refresh-all",
    response_model=StandardSuccessResponse[Dict[str, str]],
    summary="Refresh All Wallet Balances",
    description="Queries live blockchain nodes for all connected wallets.",
)
async def refresh_all(
    current_user: User = Depends(get_current_active_user),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[Dict[str, str]]:
    """Refreshes all connected wallets."""
    service = PortfolioService(session)
    await service.refresh_all_wallets(current_user.id)
    return StandardSuccessResponse(
        success=True,
        data={"message": "All wallet balances refreshed successfully."},
        metadata={"request_id": request_id},
    )
