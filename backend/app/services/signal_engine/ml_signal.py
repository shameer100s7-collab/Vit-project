"""Multi-factor quantitative and machine-learning scoring strategy."""

import math
from typing import Optional

from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import MarketState, MarketStateResult
from app.schemas.signals import SignalDirection, StrategySignal, TimeHorizon
from app.services.signal_engine.base import BaseStrategy


class MultiFactorMLStrategy(BaseStrategy):
    """Statistical multi-factor quantitative ranking strategy."""

    def __init__(self, weight: float = 1.0) -> None:
        super().__init__(name="MultiFactorMLStrategy", weight=weight)

    def generate_signal(
        self,
        snapshot: FeatureSnapshot,
        market_state: Optional[MarketStateResult] = None,
    ) -> StrategySignal:
        f = snapshot.features
        symbol = snapshot.symbol

        trend_strength = f.get("trend_strength", 0.0)
        rsi = f.get("rsi_14", 50.0)
        imbalance = f.get("orderbook_imbalance", 0.0)
        drawdown = f.get("drawdown", 0.0)
        volatility_20 = f.get("volatility_20", 0.02)

        # Factor normalizations
        f_trend = max(-1.0, min(1.0, trend_strength / 0.05))
        f_momentum = max(-1.0, min(1.0, (rsi - 50.0) / 25.0))
        f_micro = max(-1.0, min(1.0, imbalance))
        f_drawdown = max(-1.0, min(1.0, drawdown / 0.15))

        # Multi-factor weights
        w_trend = 0.35
        w_mom = 0.30
        w_micro = 0.25
        w_dd = 0.10

        composite_score = (
            (w_trend * f_trend)
            + (w_mom * f_momentum)
            + (w_micro * f_micro)
            + (w_dd * f_drawdown)
        )

        regime = market_state.state if market_state else MarketState.UNCERTAIN

        # Regime adjustment
        if regime == MarketState.UNCERTAIN:
            composite_score *= 0.65  # dampen under regime uncertainty

        reasons = [
            f"Multi-factor score: {composite_score:+.3f} across trend, momentum, and orderbook factors",
        ]
        if abs(f_micro) > 0.20:
            reasons.append(f"Microstructure factor contributing {f_micro:+.2f} orderbook imbalance weight")
        if abs(f_trend) > 0.20:
            reasons.append(f"Trend factor contributing {f_trend:+.2f} moving average momentum")

        metrics = {
            "composite_score": round(composite_score, 4),
            "factor_trend": round(f_trend, 4),
            "factor_momentum": round(f_momentum, 4),
            "factor_microstructure": round(f_micro, 4),
        }

        direction: SignalDirection
        confidence: float
        strength: float

        abs_score = abs(composite_score)
        if composite_score >= 0.20:
            direction = SignalDirection.LONG
            confidence = min(0.88, 0.52 + 0.36 * abs_score)
            strength = min(0.95, abs_score * 1.1)
        elif composite_score <= -0.20:
            direction = SignalDirection.SHORT
            confidence = min(0.88, 0.52 + 0.36 * abs_score)
            strength = min(0.95, abs_score * 1.1)
        else:
            direction = SignalDirection.NEUTRAL
            confidence = 0.50
            strength = 0.10
            reasons.append("Multi-factor composite score resides within neutral equilibrium band")

        confidence = round(max(0.05, min(0.95, confidence)), 4)
        strength = round(max(0.0, min(1.0, strength)), 4)

        return StrategySignal(
            strategy_name=self.name,
            asset=symbol,
            direction=direction,
            confidence=confidence,
            strength=strength,
            time_horizon=TimeHorizon.MEDIUM_TERM,
            reasons=reasons,
            metrics=metrics,
        )
