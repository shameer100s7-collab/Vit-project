"""Quantitative risk evaluation API endpoints."""

from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_request_id
from app.db.database import get_db
from app.schemas.common import StandardSuccessResponse
from app.schemas.risk import (
    AssetRiskResult,
    PortfolioRiskRequest,
    PortfolioRiskResult,
    RiskHistoryItem,
)
from app.services.risk_engine import RiskEngineService, get_risk_service

router = APIRouter()


@router.get(
    "/{symbol}",
    response_model=StandardSuccessResponse[AssetRiskResult],
    summary="Asset Quantitative Risk Analysis",
    description=(
        "Evaluates parametric and historical Value at Risk (VaR 95/99%), Conditional VaR (CVaR), "
        "Sharpe/Sortino/Calmar ratios, max drawdown dynamics, benchmark Beta, and volatility-targeted "
        "position sizing boundaries."
    ),
)
async def get_asset_risk(
    symbol: str,
    timeframe: str = Query("1h", description="Candle interval (e.g. 15m, 1h, 4h, 1d)"),
    limit: int = Query(100, ge=30, le=500, description="Lookback window for statistical estimation"),
    benchmark: str = Query("BTC/USDT", description="Benchmark symbol for Beta sensitivity"),
    service: RiskEngineService = Depends(get_risk_service),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[AssetRiskResult]:
    """Evaluates comprehensive quantitative risk metrics for an individual asset."""
    result = await service.evaluate_asset_risk(
        symbol=symbol,
        timeframe=timeframe,
        lookback_candles=limit,
        benchmark_symbol=benchmark,
        session=session,
        persist=True,
    )
    return StandardSuccessResponse(
        success=True,
        data=result,
        metadata={
            "request_id": request_id,
            "symbol": result.symbol,
            "overall_risk_score": result.overall_risk_score,
            "risk_level": result.risk_level.value,
            "volatility_annualized": result.volatility_annualized,
            "var_95_daily": result.var_metrics.var_95_daily,
            "max_drawdown": result.drawdown_metrics.max_drawdown,
            "analysis_id": result.analysis_id,
        },
    )


@router.get(
    "/{symbol}/history",
    response_model=StandardSuccessResponse[List[RiskHistoryItem]],
    summary="Asset Risk Evaluation History",
    description="Retrieves historical quantitative risk analysis records for auditability and trend tracking.",
)
async def get_asset_risk_history(
    symbol: str,
    limit: int = Query(50, ge=1, le=200, description="Maximum number of historical records to return"),
    service: RiskEngineService = Depends(get_risk_service),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[List[RiskHistoryItem]]:
    """Retrieves chronologically ordered past risk evaluations for an asset."""
    records = await service.get_historical_risk(
        target_type="ASSET",
        target_id=symbol.upper().strip(),
        limit=limit,
        session=session,
    )
    return StandardSuccessResponse(
        success=True,
        data=records,
        metadata={
            "request_id": request_id,
            "symbol": symbol.upper().strip(),
            "count": len(records),
        },
    )


@router.post(
    "/portfolio",
    response_model=StandardSuccessResponse[PortfolioRiskResult],
    summary="Custom Portfolio Risk Evaluation",
    description=(
        "Evaluates cross-asset covariance structure, portfolio-level VaR/CVaR, "
        "Herfindahl-Hirschman Index (HHI) concentration, Sharpe/Sortino ratios, "
        "and marginal risk contributions across custom asset allocations."
    ),
)
async def evaluate_custom_portfolio_risk(
    request: PortfolioRiskRequest,
    service: RiskEngineService = Depends(get_risk_service),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[PortfolioRiskResult]:
    """Evaluates quantitative risk for an ad-hoc custom portfolio of asset allocations."""
    result = await service.evaluate_portfolio_risk(
        request=request,
        session=session,
        persist=True,
    )
    return StandardSuccessResponse(
        success=True,
        data=result,
        metadata={
            "request_id": request_id,
            "overall_risk_score": result.overall_risk_score,
            "risk_level": result.risk_level.value,
            "portfolio_volatility": result.portfolio_volatility_annualized,
            "portfolio_var_95": result.portfolio_var_95_daily,
            "hhi": result.concentration.hhi,
            "analysis_id": result.analysis_id,
        },
    )


@router.get(
    "/portfolio/{portfolio_id}",
    response_model=StandardSuccessResponse[PortfolioRiskResult],
    summary="Stored Portfolio Risk Evaluation",
    description="Loads a stored user portfolio and its holdings from the database and runs full quantitative risk modeling.",
)
async def evaluate_stored_portfolio_risk(
    portfolio_id: str,
    timeframe: str = Query("1h", description="Candle interval (e.g. 15m, 1h, 4h, 1d)"),
    limit: int = Query(100, ge=30, le=500, description="Lookback window for statistical estimation"),
    service: RiskEngineService = Depends(get_risk_service),
    session: AsyncSession = Depends(get_db),
    request_id: str = Depends(get_request_id),
) -> StandardSuccessResponse[PortfolioRiskResult]:
    """Loads and analyzes risk for a persisted portfolio entity."""
    result = await service.evaluate_stored_portfolio_risk(
        portfolio_id=portfolio_id,
        session=session,
        timeframe=timeframe,
        lookback_candles=limit,
    )
    return StandardSuccessResponse(
        success=True,
        data=result,
        metadata={
            "request_id": request_id,
            "portfolio_id": portfolio_id,
            "overall_risk_score": result.overall_risk_score,
            "risk_level": result.risk_level.value,
            "portfolio_volatility": result.portfolio_volatility_annualized,
            "analysis_id": result.analysis_id,
        },
    )
