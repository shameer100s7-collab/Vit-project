"""Market intelligence, regime classification, and quantitative diagnostics endpoints."""

from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_request_id
from app.db.database import get_db
from app.schemas.common import StandardSuccessResponse
from app.schemas.market_state import MarketStateResult
from app.services.market_state import MarketStateService, get_market_state_service

router = APIRouter()


@router.get(
    "/{symbol}/state",
    response_model=StandardSuccessResponse[MarketStateResult],
    summary="Asset Market Regime State",
    description=(
        "Returns the quantitative market regime classification (e.g. BULLISH_TREND, BEARISH_TREND, "
        "SIDEWAYS, HIGH_VOLATILITY, LOW_VOLATILITY, ACCUMULATION_LIKE, DISTRIBUTION_LIKE, UNCERTAIN) "
        "with supporting indicator evidence, conflict metrics, and bounded confidence (0.05 <= c <= 0.95)."
    ),
)
async def get_market_state(
    symbol: str,
    timeframe: str = Query("1h", description="Candle interval (e.g., 15m, 1h, 4h, 1d)"),
    limit: int = Query(100, ge=5, le=500, description="Number of historical candles for indicator warm-up"),
    service: MarketStateService = Depends(get_market_state_service),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[MarketStateResult]:
    """Retrieves point-in-time quantitative regime classification for an asset."""
    result = await service.get_market_state(
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
            "state": result.state.value,
            "confidence": result.confidence,
            "conflict_detected": result.conflict_detected,
        },
    )
