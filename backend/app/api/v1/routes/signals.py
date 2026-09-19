"""Quantitative trading signals and multi-strategy consensus endpoints."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_request_id
from app.db.database import get_db
from app.schemas.common import StandardSuccessResponse
from app.schemas.market_context import MarketContextRequest, MarketContextResult, ScreenshotQualityGateResult
from app.schemas.signals import AggregatedSignalResult, SignalHistoryItem
from app.services.market_context import MarketContextService, get_market_context_service
from app.services.signal_engine import SignalService, get_signal_service

router = APIRouter()


@router.post(
    "/context/analyze",
    response_model=StandardSuccessResponse[MarketContextResult],
    summary="Analyze Market Context from Screenshot",
    description=(
        "Transforms a user chart screenshot into structured, evidence-based market context. "
        "Enforces a strict visual Quality Gate, builds a 7-dimensional Market Map (Price, Structure, "
        "Time, Volume, Range, Location, Candle Behavior), identifies supporting and conflicting evidence, "
        "and defines objective What to Watch conditions without generating buy/sell prediction signals."
    ),
)
async def analyze_market_context(
    payload: MarketContextRequest,
    service: MarketContextService = Depends(get_market_context_service),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[MarketContextResult]:
    """Analyzes market context from an uploaded chart screenshot."""
    result = await service.analyze_context(payload)
    return StandardSuccessResponse(
        success=True,
        data=result,
        metadata={
            "request_id": request_id,
            "asset": result.asset,
            "timeframe": result.timeframe,
            "evidence_quality": result.evidence_quality.value,
            "market_state": result.market_state.state.value,
            "quality_gate_passed": result.quality_gate.quality_gate_passed,
        },
    )


@router.post(
    "/context/quality-check",
    response_model=StandardSuccessResponse[ScreenshotQualityGateResult],
    summary="Pre-flight Screenshot Quality Check",
    description="Validates image resolution, sharpness, and candle visibility before full market analysis.",
)
async def check_screenshot_quality(
    payload: MarketContextRequest,
    service: MarketContextService = Depends(get_market_context_service),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[ScreenshotQualityGateResult]:
    """Performs pre-flight quality check on chart screenshot."""
    result = service.check_quality(
        image_data=payload.image_data,
        asset=payload.asset,
        timeframe=payload.timeframe,
        has_volume=payload.has_volume if payload.has_volume is not None else True,
    )
    return StandardSuccessResponse(
        success=True,
        data=result,
        metadata={
            "request_id": request_id,
            "quality_gate_passed": result.quality_gate_passed,
            "clarity_rating": result.clarity_rating.value,
        },
    )



@router.get(
    "/{symbol}",
    response_model=StandardSuccessResponse[AggregatedSignalResult],
    summary="Asset Quantitative Signal",
    description=(
        "Returns live multi-strategy consensus signal (LONG, SHORT, HOLD, NEUTRAL) "
        "conditioned on the current macro market regime, with individual strategy "
        "breakdowns for explainability and bounded confidence [0.05, 0.95]."
    ),
)
async def get_asset_signal(
    symbol: str,
    timeframe: str = Query("1h", description="Candle interval (e.g., 15m, 1h, 4h, 1d)"),
    limit: int = Query(100, ge=5, le=500, description="Lookback periods for feature warm-up"),
    service: SignalService = Depends(get_signal_service),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[AggregatedSignalResult]:
    """Generates consensus quantitative trading signal for an asset."""
    result = await service.get_signal(
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
            "symbol": result.asset,
            "direction": result.direction.value,
            "confidence": result.confidence,
            "strength": result.strength,
            "market_state": result.market_state,
        },
    )


@router.get(
    "/{symbol}/history",
    response_model=StandardSuccessResponse[List[SignalHistoryItem]],
    summary="Asset Signal History",
    description="Retrieves chronological log of historically generated quantitative signals for auditability.",
)
async def get_signal_history(
    symbol: str,
    limit: int = Query(50, ge=1, le=200, description="Max historical signal entries to retrieve"),
    service: SignalService = Depends(get_signal_service),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[List[SignalHistoryItem]]:
    """Retrieves persisted signal history for an asset."""
    clean_symbol = symbol.upper().strip()
    history = await service.get_recent_signals(
        symbol=clean_symbol,
        limit=limit,
        session=session,
    )
    return StandardSuccessResponse(
        success=True,
        data=history,
        metadata={
            "request_id": request_id,
            "symbol": clean_symbol,
            "count": len(history),
        },
    )
