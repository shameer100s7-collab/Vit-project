"""Master quantitative risk service orchestrating multi-model risk evaluations and persistence."""

import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import UUID
from fastapi import Depends
import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, ValidationException
from app.core.logging import get_logger
from app.db.database import get_db
from app.db.repositories.portfolio import PortfolioRepository
from app.db.repositories.risk import RiskRepository
from app.schemas.risk import (
    AssetRiskResult,
    DrawdownMetrics,
    PortfolioAssetInput,
    PortfolioRiskRequest,
    PortfolioRiskResult,
    PositionSizingRecommendation,
    RiskAdjustedMetrics,
    RiskHistoryItem,
    RiskLevel,
    SensitivityMetrics,
    VaRMetrics,
)
from app.services.market_data import MarketDataService, get_market_data_service
from app.services.risk_engine.drawdown_calculator import DrawdownCalculator
from app.services.risk_engine.metrics_calculator import RiskMetricsCalculator
from app.services.risk_engine.portfolio_risk import PortfolioRiskCalculator
from app.services.risk_engine.position_sizing import PositionSizingEngine
from app.services.risk_engine.var_calculator import VaRCalculator

logger = get_logger("ghost.risk_engine.service")


class RiskEngineService:
    """End-to-end quantitative risk engine service."""

    def __init__(
        self,
        market_data_service: Optional[MarketDataService] = None,
    ) -> None:
        self.market_data_service = market_data_service or get_market_data_service()

    async def evaluate_asset_risk(
        self,
        symbol: str,
        timeframe: str = "1h",
        lookback_candles: int = 100,
        benchmark_symbol: str = "BTC/USDT",
        session: Optional[AsyncSession] = None,
        persist: bool = True,
    ) -> AssetRiskResult:
        """Evaluates comprehensive quantitative risk metrics for a single cryptocurrency asset."""
        clean_symbol = symbol.upper().strip()
        clean_benchmark = benchmark_symbol.upper().strip()

        # Fetch asset candles
        try:
            candles = await self.market_data_service.get_ohlcv(
                symbol=clean_symbol,
                timeframe=timeframe,
                limit=lookback_candles,
                session=session,
            )
        except Exception as e:
            logger.error("Failed to fetch candle history for %s: %s", clean_symbol, e)
            raise NotFoundException(f"Market data history unavailable for {clean_symbol}") from e

        if not candles or len(candles) < 3:
            raise NotFoundException(f"Insufficient candle history ({len(candles) if candles else 0}) for {clean_symbol}")

        # Extract prices and returns
        prices = pd.Series([float(c.close) for c in candles], dtype=float)
        shifted = prices.shift(1)
        pct_returns = ((prices - shifted) / shifted.replace(0.0, np.nan)).fillna(0.0)

        # 1. VaR & CVaR
        var_metrics: VaRMetrics = VaRCalculator.evaluate_var_metrics(pct_returns)

        # 2. Drawdown
        drawdown_metrics: DrawdownMetrics = DrawdownCalculator.calculate_drawdown_metrics(prices)

        # 3. Risk-Adjusted Returns & Volatility
        vol_daily = float(pct_returns.std(ddof=1))
        risk_adjusted: RiskAdjustedMetrics = RiskMetricsCalculator.calculate_risk_adjusted_metrics(
            returns=pct_returns,
            max_drawdown=drawdown_metrics.max_drawdown,
            risk_free_rate=0.04,
        )

        # 4. Sensitivity & Beta vs Benchmark
        sensitivity: Optional[SensitivityMetrics] = None
        if clean_symbol == clean_benchmark:
            sensitivity = SensitivityMetrics(
                beta=1.0,
                correlation_with_benchmark=1.0,
                benchmark_symbol=clean_benchmark,
            )
        else:
            try:
                bm_candles = await self.market_data_service.get_ohlcv(
                    symbol=clean_benchmark,
                    timeframe=timeframe,
                    limit=lookback_candles,
                    session=session,
                )
                if bm_candles and len(bm_candles) >= 3:
                    bm_prices = pd.Series([float(c.close) for c in bm_candles], dtype=float)
                    bm_shifted = bm_prices.shift(1)
                    bm_returns = ((bm_prices - bm_shifted) / bm_shifted.replace(0.0, np.nan)).fillna(0.0)
                    sensitivity = RiskMetricsCalculator.calculate_beta_and_correlation(
                        asset_returns=pct_returns,
                        benchmark_returns=bm_returns,
                        benchmark_symbol=clean_benchmark,
                    )
            except Exception as e:
                logger.warning("Benchmark market data fetch failed for %s: %s", clean_benchmark, e)
                sensitivity = SensitivityMetrics(
                    beta=1.0,
                    correlation_with_benchmark=0.5,
                    benchmark_symbol=clean_benchmark,
                )

        # 5. Position Sizing Recommendation
        position_sizing: PositionSizingRecommendation = PositionSizingEngine.calculate_position_sizing(
            volatility_annualized=risk_adjusted.annualized_volatility,
            var_95_daily=var_metrics.var_95_daily,
            max_drawdown=drawdown_metrics.max_drawdown,
        )

        # 6. Composite Overall Risk Score in [0.0, 1.0]
        norm_vol = min(1.0, risk_adjusted.annualized_volatility / 1.20)
        norm_var = min(1.0, var_metrics.var_95_daily / 0.08)
        norm_mdd = min(1.0, abs(drawdown_metrics.max_drawdown) / 0.40)
        norm_cvar = min(1.0, var_metrics.cvar_95_daily / 0.12)

        composite_score = (
            0.35 * norm_vol +
            0.30 * norm_var +
            0.25 * norm_mdd +
            0.10 * norm_cvar
        )
        overall_risk_score = float(np.clip(composite_score, 0.05, 0.95))

        # Risk level classification
        if overall_risk_score < 0.28:
            risk_level = RiskLevel.LOW
        elif overall_risk_score < 0.58:
            risk_level = RiskLevel.MODERATE
        elif overall_risk_score < 0.80:
            risk_level = RiskLevel.HIGH
        else:
            risk_level = RiskLevel.CRITICAL

        # 7. Actionable Risk Warnings
        risk_warnings: List[str] = []
        if risk_adjusted.annualized_volatility >= 0.70:
            risk_warnings.append(f"Elevated annualized volatility ({round(risk_adjusted.annualized_volatility * 100, 1)}%)")
        if drawdown_metrics.max_drawdown <= -0.30:
            risk_warnings.append(f"Deep historical drawdown ({round(drawdown_metrics.max_drawdown * 100, 1)}%)")
        if var_metrics.var_95_daily >= 0.05:
            risk_warnings.append(f"Elevated 1-day 95% tail risk (VaR {round(var_metrics.var_95_daily * 100, 1)}%)")
        if sensitivity and sensitivity.beta >= 1.50:
            risk_warnings.append(f"High systematic market exposure (Beta {round(sensitivity.beta, 2)}x)")

        analysis_id: Optional[str] = None
        now_utc = datetime.now(timezone.utc)

        # 8. Database Persistence
        if persist and session is not None:
            try:
                repo = RiskRepository(session)
                metrics_payload = {
                    "var_metrics": var_metrics.model_dump(),
                    "drawdown_metrics": drawdown_metrics.model_dump(),
                    "risk_adjusted": risk_adjusted.model_dump(),
                    "sensitivity": sensitivity.model_dump() if sensitivity else None,
                    "position_sizing": position_sizing.model_dump(),
                    "risk_warnings": risk_warnings,
                }
                record = await repo.create(
                    target_type="ASSET",
                    target_id=clean_symbol,
                    overall_risk=round(overall_risk_score, 4),
                    volatility=risk_adjusted.annualized_volatility,
                    var_95=var_metrics.var_95_daily,
                    cvar_95=var_metrics.cvar_95_daily,
                    max_drawdown=drawdown_metrics.max_drawdown,
                    sharpe_ratio=risk_adjusted.sharpe_ratio,
                    sortino_ratio=risk_adjusted.sortino_ratio,
                    beta=sensitivity.beta if sensitivity else 1.0,
                    concentration_risk=1.0,
                    metrics_payload=metrics_payload,
                    timestamp=now_utc,
                )
                await session.commit()
                analysis_id = str(record.id)
            except Exception as e:
                logger.error("Failed to persist RiskAnalysis record for %s: %s", clean_symbol, e)
                await session.rollback()

        return AssetRiskResult(
            symbol=clean_symbol,
            timestamp=now_utc,
            overall_risk_score=round(overall_risk_score, 4),
            risk_level=risk_level,
            volatility_daily=round(vol_daily, 4),
            volatility_annualized=risk_adjusted.annualized_volatility,
            var_metrics=var_metrics,
            drawdown_metrics=drawdown_metrics,
            risk_adjusted_metrics=risk_adjusted,
            sensitivity_metrics=sensitivity,
            position_sizing=position_sizing,
            risk_warnings=risk_warnings,
            analysis_id=analysis_id,
        )

    async def evaluate_portfolio_risk(
        self,
        request: PortfolioRiskRequest,
        session: Optional[AsyncSession] = None,
        persist: bool = True,
        portfolio_id: Optional[str] = None,
    ) -> PortfolioRiskResult:
        """Evaluates portfolio-level quantitative risk, covariance structure, and HHI concentration."""
        if not request.assets:
            raise ValidationException("Portfolio must contain at least one asset")

        raw_weights = {a.symbol: a.weight for a in request.assets}
        concentration = PortfolioRiskCalculator.calculate_concentration(raw_weights)

        # Concurrently evaluate each asset
        eval_tasks = [
            self.evaluate_asset_risk(
                symbol=asset.symbol,
                timeframe=request.timeframe,
                lookback_candles=request.lookback_candles,
                benchmark_symbol=request.benchmark_symbol,
                session=session,
                persist=False,
            )
            for asset in request.assets
        ]
        asset_results = await asyncio.gather(*eval_tasks, return_exceptions=True)

        component_risks: Dict[str, AssetRiskResult] = {}
        asset_returns_map: Dict[str, pd.Series] = {}

        for asset, res in zip(request.assets, asset_results):
            if isinstance(res, Exception):
                logger.warning("Error evaluating component asset risk for %s: %s", asset.symbol, res)
                continue
            component_risks[asset.symbol] = res

            # Re-fetch candle returns for portfolio synthesis
            candles = await self.market_data_service.get_ohlcv(
                symbol=asset.symbol,
                timeframe=request.timeframe,
                limit=request.lookback_candles,
                session=session,
            )
            prices = pd.Series([float(c.close) for c in candles], dtype=float)
            shifted = prices.shift(1)
            pct_returns = ((prices - shifted) / shifted.replace(0.0, np.nan)).fillna(0.0)
            asset_returns_map[asset.symbol] = pct_returns

        if not component_risks:
            raise NotFoundException("None of the portfolio assets could be analyzed")

        # Multi-asset portfolio return synthesis and marginal risk contributions
        port_returns, port_ann_vol, mrc_dict = PortfolioRiskCalculator.compute_portfolio_returns_and_risk(
            asset_returns=asset_returns_map,
            weights=concentration.asset_weights,
        )

        # Portfolio VaR and CVaR
        port_var_metrics = VaRCalculator.evaluate_var_metrics(port_returns)

        # Portfolio cumulative value series for drawdown
        cum_ret = (1.0 + port_returns).cumprod()
        port_drawdown = DrawdownCalculator.calculate_drawdown_metrics(cum_ret)

        # Portfolio risk-adjusted returns
        port_risk_adjusted = RiskMetricsCalculator.calculate_risk_adjusted_metrics(
            returns=port_returns,
            max_drawdown=port_drawdown.max_drawdown,
            risk_free_rate=0.04,
        )

        # Composite portfolio risk score
        norm_vol = min(1.0, port_ann_vol / 1.0)
        norm_var = min(1.0, port_var_metrics.var_95_daily / 0.07)
        norm_mdd = min(1.0, abs(port_drawdown.max_drawdown) / 0.35)
        norm_conc = concentration.normalized_hhi

        composite_score = (
            0.30 * norm_vol +
            0.30 * norm_var +
            0.25 * norm_mdd +
            0.15 * norm_conc
        )
        overall_score = float(np.clip(composite_score, 0.05, 0.95))

        if overall_score < 0.28:
            risk_level = RiskLevel.LOW
        elif overall_score < 0.58:
            risk_level = RiskLevel.MODERATE
        elif overall_score < 0.80:
            risk_level = RiskLevel.HIGH
        else:
            risk_level = RiskLevel.CRITICAL

        portfolio_warnings: List[str] = []
        if concentration.normalized_hhi >= 0.50:
            portfolio_warnings.append(f"High portfolio capital concentration (Normalized HHI {round(concentration.normalized_hhi, 2)})")
        if port_ann_vol >= 0.60:
            portfolio_warnings.append(f"High portfolio annualized volatility ({round(port_ann_vol * 100, 1)}%)")
        if port_drawdown.max_drawdown <= -0.25:
            portfolio_warnings.append(f"Elevated aggregate portfolio drawdown ({round(port_drawdown.max_drawdown * 100, 1)}%)")

        analysis_id: Optional[str] = None
        now_utc = datetime.now(timezone.utc)
        target_id = portfolio_id or request.portfolio_name or "PORTFOLIO_AD_HOC"

        # Database Persistence
        if persist and session is not None:
            try:
                repo = RiskRepository(session)
                metrics_payload = {
                    "concentration": concentration.model_dump(),
                    "marginal_risk_contributions": mrc_dict,
                    "var_metrics": port_var_metrics.model_dump(),
                    "drawdown_metrics": port_drawdown.model_dump(),
                    "risk_adjusted": port_risk_adjusted.model_dump(),
                    "risk_warnings": portfolio_warnings,
                }
                record = await repo.create(
                    target_type="PORTFOLIO",
                    target_id=target_id,
                    overall_risk=round(overall_score, 4),
                    volatility=port_ann_vol,
                    var_95=port_var_metrics.var_95_daily,
                    cvar_95=port_var_metrics.cvar_95_daily,
                    max_drawdown=port_drawdown.max_drawdown,
                    sharpe_ratio=port_risk_adjusted.sharpe_ratio,
                    sortino_ratio=port_risk_adjusted.sortino_ratio,
                    beta=1.0,
                    concentration_risk=concentration.hhi,
                    metrics_payload=metrics_payload,
                    timestamp=now_utc,
                )
                await session.commit()
                analysis_id = str(record.id)
            except Exception as e:
                logger.error("Failed to persist portfolio RiskAnalysis record for %s: %s", target_id, e)
                await session.rollback()

        return PortfolioRiskResult(
            portfolio_id=portfolio_id,
            portfolio_name=request.portfolio_name,
            timestamp=now_utc,
            overall_risk_score=round(overall_score, 4),
            risk_level=risk_level,
            portfolio_volatility_annualized=port_ann_vol,
            portfolio_var_95_daily=port_var_metrics.var_95_daily,
            portfolio_cvar_95_daily=port_var_metrics.cvar_95_daily,
            portfolio_sharpe_ratio=port_risk_adjusted.sharpe_ratio,
            portfolio_sortino_ratio=port_risk_adjusted.sortino_ratio,
            max_drawdown=port_drawdown.max_drawdown,
            concentration=concentration,
            marginal_risk_contributions=mrc_dict,
            component_risks=component_risks,
            risk_warnings=portfolio_warnings,
            analysis_id=analysis_id,
        )

    async def evaluate_stored_portfolio_risk(
        self,
        portfolio_id: str,
        session: AsyncSession,
        timeframe: str = "1h",
        lookback_candles: int = 100,
    ) -> PortfolioRiskResult:
        """Evaluates risk for a stored User Portfolio fetched from the database."""
        try:
            p_uuid = UUID(portfolio_id)
        except ValueError as e:
            raise ValidationException(f"Invalid portfolio UUID format: {portfolio_id}") from e

        port_repo = PortfolioRepository(session)
        portfolio = await port_repo.get_with_assets(p_uuid)
        if not portfolio:
            raise NotFoundException(f"Portfolio {portfolio_id} not found")

        if not portfolio.assets:
            raise ValidationException(f"Portfolio {portfolio_id} has no underlying asset holdings")

        assets = [
            PortfolioAssetInput(
                symbol=a.symbol,
                weight=a.current_weight if a.current_weight > 0 else (a.target_weight if a.target_weight > 0 else 1.0),
                quantity=a.quantity,
                avg_entry_price=a.avg_entry_price,
            )
            for a in portfolio.assets
        ]

        request = PortfolioRiskRequest(
            assets=assets,
            timeframe=timeframe,
            lookback_candles=lookback_candles,
            portfolio_name=portfolio.name,
        )

        return await self.evaluate_portfolio_risk(
            request=request,
            session=session,
            persist=True,
            portfolio_id=str(portfolio.id),
        )

    async def get_historical_risk(
        self,
        target_type: str,
        target_id: str,
        limit: int = 50,
        session: Optional[AsyncSession] = None,
    ) -> List[RiskHistoryItem]:
        """Retrieves historical persisted risk analysis records for an asset or portfolio."""
        if not session:
            return []

        repo = RiskRepository(session)
        records = await repo.get_recent_analyses(
            target_type=target_type,
            target_id=target_id,
            limit=limit,
        )
        return [
            RiskHistoryItem(
                id=str(r.id),
                target_type=r.target_type,
                target_id=r.target_id,
                overall_risk=r.overall_risk,
                volatility=r.volatility,
                var_95=r.var_95,
                cvar_95=r.cvar_95,
                max_drawdown=r.max_drawdown,
                sharpe_ratio=r.sharpe_ratio,
                sortino_ratio=r.sortino_ratio,
                beta=r.beta,
                concentration_risk=r.concentration_risk,
                timestamp=r.timestamp,
                metrics_payload=r.metrics_payload or {},
            )
            for r in records
        ]


# Singleton instance
_risk_service_instance: Optional[RiskEngineService] = None


def get_risk_service(
    market_data_service: MarketDataService = Depends(get_market_data_service),
) -> RiskEngineService:
    """Factory dependency returning RiskEngineService singleton."""
    global _risk_service_instance
    if _risk_service_instance is None:
        _risk_service_instance = RiskEngineService(
            market_data_service=market_data_service,
        )
    return _risk_service_instance
