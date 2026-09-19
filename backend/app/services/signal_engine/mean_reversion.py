"""Mean-reversion strategy trading statistical overextensions and band reversions."""

from typing import Optional

from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import MarketState, MarketStateResult
from app.schemas.signals import SignalDirection, StrategySignal, TimeHorizon
from app.services.signal_engine.base import BaseStrategy


class MeanReversionStrategy(BaseStrategy):
    """Mean-reversion strategy seeking statistical price return to moving average equilibrium."""

    def __init__(self, weight: float = 1.0) -> None:
        super().__init__(name="MeanReversionStrategy", weight=weight)

    def generate_signal(
        self,
        snapshot: FeatureSnapshot,
        market_state: Optional[MarketStateResult] = None,
    ) -> StrategySignal:
        f = snapshot.features
        symbol = snapshot.symbol

        rsi = f.get("rsi_14", 50.0)
        drawdown = f.get("drawdown", 0.0)
        bb_bandwidth = f.get("bb_bandwidth", 0.04)
        trend_strength = f.get("trend_strength", 0.0)

        reasons = []
        metrics = {
            "rsi_14": round(rsi, 2),
            "drawdown": round(drawdown, 4),
            "bb_bandwidth": round(bb_bandwidth, 4),
        }

        regime = market_state.state if market_state else MarketState.UNCERTAIN

        # 1. Regime Protection: Suppress mean-reversion in strong directional trends
        if regime in (MarketState.BULLISH_TREND, MarketState.BEARISH_TREND) and abs(trend_strength) > 0.02:
            return StrategySignal(
                strategy_name=self.name,
                asset=symbol,
                direction=SignalDirection.HOLD,
                confidence=0.70,
                strength=0.15,
                time_horizon=TimeHorizon.SHORT_TERM,
                reasons=[
                    f"Mean reversion actively suppressed during established {regime.value}",
                    "Counter-trend entries carry severe asymmetric drawdown risk",
                ],
                metrics=metrics,
            )

        # 2. Evaluate Mean Reversion Setups
        direction: SignalDirection
        confidence: float
        strength: float

        if rsi <= 32.0 or (drawdown <= -0.06 and rsi <= 38.0):
            direction = SignalDirection.LONG
            confidence = min(0.85, 0.58 + (35.0 - rsi) * 0.015)
            strength = min(0.85, 0.40 + abs(drawdown) * 3.0)
            reasons.append(f"Oversold exhaustion detected (RSI={rsi:.1f}, Drawdown={drawdown:.1%})")
            reasons.append("High statistical probability of upward mean-reversion toward equilibrium")
        elif rsi >= 68.0 and drawdown >= -0.01:
            direction = SignalDirection.SHORT
            confidence = min(0.85, 0.58 + (rsi - 65.0) * 0.015)
            strength = min(0.85, 0.40 + (rsi - 65.0) * 0.02)
            reasons.append(f"Overbought exhaustion detected (RSI={rsi:.1f})")
            reasons.append("High statistical probability of downward mean-reversion toward equilibrium")
        elif regime == MarketState.SIDEWAYS:
            direction = SignalDirection.HOLD
            confidence = 0.60
            strength = 0.20
            reasons.append("Market in central range; awaiting boundary overextension for mean-reversion entry")
        else:
            direction = SignalDirection.NEUTRAL
            confidence = 0.50
            strength = 0.10
            reasons.append("Asset pricing currently within normal statistical equilibrium bands")

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
