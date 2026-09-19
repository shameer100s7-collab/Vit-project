"""Technical trend-following strategy based on moving average structures and price action."""

from typing import Optional

from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import MarketState, MarketStateResult
from app.schemas.signals import SignalDirection, StrategySignal, TimeHorizon
from app.services.signal_engine.base import BaseStrategy


class TechnicalStrategy(BaseStrategy):
    """Trend-following strategy leveraging moving average crossovers and structural trend strength."""

    def __init__(self, weight: float = 1.0) -> None:
        super().__init__(name="TechnicalStrategy", weight=weight)

    def generate_signal(
        self,
        snapshot: FeatureSnapshot,
        market_state: Optional[MarketStateResult] = None,
    ) -> StrategySignal:
        f = snapshot.features
        symbol = snapshot.symbol

        close = f.get("close", 1.0)
        ema_12 = f.get("ema_12", 0.0)
        ema_26 = f.get("ema_26", 0.0)
        sma_20 = f.get("sma_20", 0.0)
        sma_50 = f.get("sma_50", 0.0)
        trend_strength = f.get("trend_strength", 0.0)

        reasons = []
        metrics = {
            "ema_diff": round(ema_12 - ema_26, 4),
            "sma_diff": round(sma_20 - sma_50, 4),
            "trend_strength": round(trend_strength, 4),
        }

        # Check regime alignment
        regime = market_state.state if market_state else MarketState.UNCERTAIN

        bullish_signals = 0
        bearish_signals = 0

        # Fast MA crossover
        if ema_12 > ema_26:
            bullish_signals += 1
            reasons.append("Fast EMA (12) trades above Slow EMA (26)")
        elif ema_12 < ema_26:
            bearish_signals += 1
            reasons.append("Fast EMA (12) trades below Slow EMA (26)")

        # Medium MA structure
        if sma_20 > sma_50 and close > sma_50:
            bullish_signals += 1
            reasons.append("Price and 20 SMA hold structural support above 50 SMA")
        elif sma_20 < sma_50 and close < sma_50:
            bearish_signals += 1
            reasons.append("Price and 20 SMA confirm overhead resistance below 50 SMA")

        # Trend strength check
        if trend_strength > 0.015:
            bullish_signals += 1
            reasons.append(f"Significant positive trend strength ({trend_strength:+.2%})")
        elif trend_strength < -0.015:
            bearish_signals += 1
            reasons.append(f"Significant negative trend strength ({trend_strength:+.2%})")

        # Regime synergy
        if regime == MarketState.BULLISH_TREND:
            bullish_signals += 1
            reasons.append("Regime confirmation: Macro market in BULLISH_TREND")
        elif regime == MarketState.BEARISH_TREND:
            bearish_signals += 1
            reasons.append("Regime confirmation: Macro market in BEARISH_TREND")
        elif regime in (MarketState.SIDEWAYS, MarketState.UNCERTAIN):
            reasons.append(f"Macro regime is {regime.value}; trend following potency dampened")

        # Determine direction and metrics
        direction: SignalDirection
        confidence: float
        strength: float

        if bullish_signals >= 3 and bearish_signals == 0:
            direction = SignalDirection.LONG
            confidence = min(0.90, 0.55 + 0.08 * bullish_signals)
            strength = min(0.90, 0.45 + 5.0 * max(0.0, trend_strength))
        elif bearish_signals >= 3 and bullish_signals == 0:
            direction = SignalDirection.SHORT
            confidence = min(0.90, 0.55 + 0.08 * bearish_signals)
            strength = min(0.90, 0.45 + 5.0 * max(0.0, -trend_strength))
        elif bullish_signals > bearish_signals and bullish_signals >= 2:
            direction = SignalDirection.LONG
            confidence = 0.60
            strength = 0.45
        elif bearish_signals > bullish_signals and bearish_signals >= 2:
            direction = SignalDirection.SHORT
            confidence = 0.60
            strength = 0.45
        elif regime == MarketState.SIDEWAYS:
            direction = SignalDirection.HOLD
            confidence = 0.65
            strength = 0.20
            reasons.append("Market in consolidation range; awaiting directional expansion")
        else:
            direction = SignalDirection.NEUTRAL
            confidence = 0.50
            strength = 0.10
            reasons.append("Conflicting moving average posture; no clear trend advantage")

        # Bound strictly [0.05, 0.95]
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
