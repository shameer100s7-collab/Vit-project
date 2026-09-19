"""Observable participant behavior and market microstructure intelligence endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_request_id
from app.db.database import get_db
from app.schemas.behavior import BehaviorAnalysisResult
from app.schemas.common import StandardSuccessResponse
from app.services.behavior_model import BehaviorModelService, get_behavior_service

router = APIRouter()


@router.get(
    "/{symbol}",
    response_model=StandardSuccessResponse[BehaviorAnalysisResult],
    summary="Asset Observable Behavior Analysis",
    description=(
        "Returns probabilistic participant flow analysis (retail, institutional, whales, "
        "liquidity providers) inferred strictly from observable order book depth, "
        "volume absorption, and price responses. Strictly separates observations from inferences."
    ),
)
async def get_asset_behavior(
    symbol: str,
    timeframe: str = Query("1h", description="Candle interval (e.g., 15m, 1h, 4h, 1d)"),
    limit: int = Query(100, ge=5, le=500, description="Lookback periods for feature warm-up"),
    service: BehaviorModelService = Depends(get_behavior_service),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[BehaviorAnalysisResult]:
    """Retrieves observable participant behavior and microstructure intelligence for an asset."""
    result = await service.analyze_behavior(
        symbol=symbol,
        timeframe=timeframe,
        limit=limit,
        session=session,
    )
    return StandardSuccessResponse(
        success=True,
        data=result,
        metadata={
            "request_id": request_id,
            "symbol": result.symbol,
            "behavior_state": result.behavior_state.value,
            "confidence": result.confidence,
            "primary_participant": result.primary_participant.value,
        },
    )
