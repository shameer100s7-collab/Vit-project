"""Volatility breakout and regime-risk mitigation strategy."""

from typing import Optional

from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import MarketState, MarketStateResult
from app.schemas.signals import SignalDirection, StrategySignal, TimeHorizon
from app.services.signal_engine.base import BaseStrategy


class VolatilityStrategy(BaseStrategy):
    """Volatility breakout and tail-risk defense strategy."""

    def __init__(self, weight: float = 1.0) -> None:
        super().__init__(name="VolatilityStrategy", weight=weight)

    def generate_signal(
        self,
        snapshot: FeatureSnapshot,
        market_state: Optional[MarketStateResult] = None,
    ) -> StrategySignal:
        f = snapshot.features
        symbol = snapshot.symbol

        bb_bandwidth = f.get("bb_bandwidth", 0.04)
        volatility_20 = f.get("volatility_20", 0.02)
        atr_14 = f.get("atr_14", 0.0)
        close = max(f.get("close", 1.0), 1e-6)
        atr_pct = atr_14 / close
        momentum_10 = f.get("momentum_10", 0.0)

        reasons = []
        metrics = {
            "bb_bandwidth": round(bb_bandwidth, 4),
            "volatility_20": round(volatility_20, 4),
            "atr_pct": round(atr_pct, 4),
        }

        regime = market_state.state if market_state else MarketState.UNCERTAIN

        direction: SignalDirection
        confidence: float
        strength: float

        # 1. High Volatility Tail-Risk Defense
        if regime == MarketState.HIGH_VOLATILITY or bb_bandwidth >= 0.080 or volatility_20 >= 0.040:
            direction = SignalDirection.HOLD
            confidence = 0.82
            strength = 0.25
            reasons.append("Severe volatility expansion and dispersion detected")
            reasons.append("Recommending HOLD / capital preservation to avoid whipsaw losses")

        # 2. Low Volatility Squeeze Breakout Entry
        elif regime == MarketState.LOW_VOLATILITY or bb_bandwidth <= 0.028:
            reasons.append("Bollinger Bandwidth squeeze indicates imminent explosive volatility breakout")
            if momentum_10 > 0.008:
                direction = SignalDirection.LONG
                confidence = 0.72
                strength = 0.65
                reasons.append("Directional bias resolves upward with positive lead momentum")
            elif momentum_10 < -0.008:
                direction = SignalDirection.SHORT
                confidence = 0.72
                strength = 0.65
                reasons.append("Directional bias resolves downward with negative lead momentum")
            else:
                direction = SignalDirection.HOLD
                confidence = 0.60
                strength = 0.30
                reasons.append("Coiling volatility squeeze; awaiting directional trigger before deploying capital")

        else:
            direction = SignalDirection.NEUTRAL
            confidence = 0.50
            strength = 0.15
            reasons.append("Volatility metrics trade within standard baseline parameters")

        confidence = round(max(0.05, min(0.95, confidence)), 4)
        strength = round(max(0.0, min(1.0, strength)), 4)

        return StrategySignal(
            strategy_name=self.name,
            asset=symbol,
            direction=direction,
            confidence=confidence,
            strength=strength,
            time_horizon=TimeHorizon.SHORT_TERM,
            reasons=reasons,
            metrics=metrics,
        )
