"""Quantitative evidence evaluation and conflict analysis for market regimes."""

from typing import Any, Dict, List, Tuple

from app.schemas.market_state import EvidenceItem, MarketState


class ConflictAnalyzer:
    """Detects and quantifies conflicting signals among technical and microstructure indicators."""

    @staticmethod
    def analyze_conflicts(
        features: Dict[str, float],
        scores: Dict[MarketState, float],
        evidence: List[EvidenceItem],
    ) -> Tuple[bool, float, List[str]]:
        """Evaluates whether contradictory forces undermine a clear market regime.

        Returns:
            Tuple of (conflict_detected, conflict_score in [0.0, 1.0], list of conflict descriptions).
        """
        conflicts: List[str] = []
        conflict_points = 0.0

        bull_score = scores.get(MarketState.BULLISH_TREND, 0.0)
        bear_score = scores.get(MarketState.BEARISH_TREND, 0.0)
        sideways_score = scores.get(MarketState.SIDEWAYS, 0.0)

        # 1. Direct Trend Contradiction: Significant bullish and bearish evidence coexisting
        if bull_score >= 1.5 and bear_score >= 1.5:
            diff = abs(bull_score - bear_score)
            conflict_points += 0.45 * (1.0 / (1.0 + diff))
            conflicts.append(
                f"Direct trend divergence: Bullish signals (score={bull_score:.2f}) simultaneously "
                f"competing with Bearish signals (score={bear_score:.2f})."
            )

        # 2. Moving Average vs Momentum Oscillator divergence
        trend_strength = features.get("trend_strength", 0.0)
        rsi = features.get("rsi_14", 50.0)
        macd_hist = features.get("macd_hist", 0.0)

        if trend_strength > 0.015 and (rsi < 45.0 or macd_hist < -0.5):
            conflict_points += 0.25
            conflicts.append(
                f"Bearish momentum divergence: Trend strength is positive ({trend_strength:+.2%}) "
                f"but RSI ({rsi:.1f}) and MACD histogram ({macd_hist:.2f}) indicate deceleration."
            )
        elif trend_strength < -0.015 and (rsi > 55.0 or macd_hist > 0.5):
            conflict_points += 0.25
            conflicts.append(
                f"Bullish momentum divergence: Trend strength is negative ({trend_strength:+.2%}) "
                f"but RSI ({rsi:.1f}) and MACD histogram ({macd_hist:.2f}) show positive reversal."
            )

        # 3. Orderbook Microstructure vs Price Action conflict
        orderbook_imbalance = features.get("orderbook_imbalance", 0.0)
        returns = features.get("returns", 0.0)

        if bull_score > bear_score and bull_score >= 2.0 and orderbook_imbalance < -0.25:
            conflict_points += 0.30
            conflicts.append(
                f"Order flow divergence: Bullish price indicators contradict heavy ask-side "
                f"liquidity wall (imbalance={orderbook_imbalance:+.2f})."
            )
        elif bear_score > bull_score and bear_score >= 2.0 and orderbook_imbalance > 0.25:
            conflict_points += 0.30
            conflicts.append(
                f"Order flow divergence: Bearish price indicators contradict heavy bid-side "
                f"support wall (imbalance={orderbook_imbalance:+.2f})."
            )

        # 4. Low Volatility vs High Volatility coexistence (extreme regime clash)
        hi_vol_score = scores.get(MarketState.HIGH_VOLATILITY, 0.0)
        lo_vol_score = scores.get(MarketState.LOW_VOLATILITY, 0.0)
        if hi_vol_score >= 1.5 and lo_vol_score >= 1.5:
            conflict_points += 0.35
            conflicts.append(
                f"Volatility envelope divergence: Volatility indicators simultaneously suggest "
                f"compression and expansion."
            )

        # 5. Sideways vs Strong Trend coexistence
        max_trend = max(bull_score, bear_score)
        if sideways_score >= 2.0 and max_trend >= 2.0:
            conflict_points += 0.20
            conflicts.append(
                f"Range ambiguity: Sideways consolidation metrics conflict with directional trend metrics."
            )

        # Normalize conflict score to [0.0, 1.0]
        final_conflict_score = round(min(1.0, max(0.0, conflict_points)), 4)
        conflict_detected = final_conflict_score >= 0.30

        return conflict_detected, final_conflict_score, conflicts
