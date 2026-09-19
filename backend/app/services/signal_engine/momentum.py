"""Momentum and oscillator strategy based on RSI, MACD, and rate-of-change dynamics."""

from typing import Optional

from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import MarketStateResult
from app.schemas.signals import SignalDirection, StrategySignal, TimeHorizon
from app.services.signal_engine.base import BaseStrategy


class MomentumStrategy(BaseStrategy):
    """Directional momentum strategy utilizing MACD velocity and RSI acceleration."""

    def __init__(self, weight: float = 1.0) -> None:
        super().__init__(name="MomentumStrategy", weight=weight)

    def generate_signal(
        self,
        snapshot: FeatureSnapshot,
        market_state: Optional[MarketStateResult] = None,
    ) -> StrategySignal:
        f = snapshot.features
        symbol = snapshot.symbol

        rsi = f.get("rsi_14", 50.0)
        macd = f.get("macd", 0.0)
        macd_signal = f.get("macd_signal", 0.0)
        macd_hist = f.get("macd_hist", 0.0)
        momentum_10 = f.get("momentum_10", 0.0)

        reasons = []
        metrics = {
            "rsi_14": round(rsi, 2),
            "macd_hist": round(macd_hist, 4),
            "momentum_10": round(momentum_10, 4),
        }

        bull_points = 0
        bear_points = 0

        # MACD momentum
        if macd > macd_signal and macd_hist > 0:
            bull_points += 1
            reasons.append("MACD line above signal with positive histogram expansion")
        elif macd < macd_signal and macd_hist < 0:
            bear_points += 1
            reasons.append("MACD line below signal with negative histogram acceleration")

        # RSI momentum
        if 53.0 <= rsi <= 72.0:
            bull_points += 1
            reasons.append(f"RSI ({rsi:.1f}) in active bullish acceleration corridor")
        elif 28.0 <= rsi <= 47.0:
            bear_points += 1
            reasons.append(f"RSI ({rsi:.1f}) in active bearish breakdown corridor")
        elif rsi > 75.0:
            reasons.append(f"RSI ({rsi:.1f}) severely overbought; momentum exhaustion risk")
        elif rsi < 25.0:
            reasons.append(f"RSI ({rsi:.1f}) severely oversold; downside velocity climactic")

        # Rate of change / momentum_10
        if momentum_10 >= 0.015:
            bull_points += 1
            reasons.append(f"Positive 10-period price velocity ({momentum_10:+.2%})")
        elif momentum_10 <= -0.015:
            bear_points += 1
            reasons.append(f"Negative 10-period price velocity ({momentum_10:+.2%})")

        direction: SignalDirection
        confidence: float
        strength: float

        if bull_points >= 2 and bear_points == 0:
            direction = SignalDirection.LONG
            confidence = min(0.88, 0.55 + 0.10 * bull_points)
            strength = min(0.92, 0.40 + 8.0 * max(0.0, momentum_10))
        elif bear_points >= 2 and bull_points == 0:
            direction = SignalDirection.SHORT
            confidence = min(0.88, 0.55 + 0.10 * bear_points)
            strength = min(0.92, 0.40 + 8.0 * max(0.0, -momentum_10))
        elif bull_points > bear_points:
            direction = SignalDirection.LONG
            confidence = 0.58
            strength = 0.40
        elif bear_points > bull_points:
            direction = SignalDirection.SHORT
            confidence = 0.58
            strength = 0.40
        else:
            direction = SignalDirection.NEUTRAL
            confidence = 0.50
            strength = 0.15
            reasons.append("Balanced oscillator metrics with no distinct momentum edge")

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
