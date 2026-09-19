"""Deterministic rule-based market state and regime classifier."""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import (
    EvidenceItem,
    MarketState,
    MarketStateResult,
    MarketStateScores,
)
from app.services.market_state.base import MarketStateClassifier
from app.services.market_state.evidence import ConflictAnalyzer


@dataclass
class MarketStateThresholds:
    """Configurable quantitative thresholds for market regime determination."""
    # Trend thresholds
    trend_strength_bullish: float = 0.010
    trend_strength_bearish: float = 0.010
    trend_strength_sideways: float = 0.008

    # RSI momentum thresholds
    rsi_bullish: float = 53.0
    rsi_bearish: float = 47.0
    rsi_sideways_low: float = 45.0
    rsi_sideways_high: float = 55.0

    # Volatility thresholds
    bb_bandwidth_high: float = 0.070
    bb_bandwidth_low: float = 0.028
    bb_bandwidth_sideways: float = 0.045
    volatility_high: float = 0.030
    volatility_low: float = 0.012
    atr_pct_high: float = 0.025
    atr_pct_low: float = 0.010
    vol_volatility_high: float = 0.40

    # Momentum thresholds
    momentum_bullish: float = 0.015
    momentum_bearish: float = 0.015
    momentum_sideways: float = 0.008

    # Microstructure & Volume thresholds
    accumulation_imbalance: float = 0.15
    distribution_imbalance: float = -0.15
    accumulation_rsi_min: float = 35.0
    accumulation_rsi_max: float = 52.0
    distribution_rsi_min: float = 52.0
    distribution_rsi_max: float = 72.0
    volume_expansion: float = 0.12

    # Conflict and confidence calibration
    conflict_threshold: float = 0.30
    min_evidence_score: float = 2.0
    uncertainty_margin: float = 0.8
    min_confidence: float = 0.05
    max_confidence: float = 0.95


class RuleBasedMarketStateClassifier(MarketStateClassifier):
    """Deterministic quantitative classifier evaluating evidence across multiple technical dimensions."""

    def __init__(self, thresholds: Optional[MarketStateThresholds] = None) -> None:
        self.thresholds = thresholds or MarketStateThresholds()

    def _evaluate_evidence(self, f: Dict[str, float]) -> List[EvidenceItem]:
        """Evaluates granular technical indicators and returns evidence items supporting specific regimes."""
        t = self.thresholds
        items: List[EvidenceItem] = []

        close = f.get("close", 1.0)
        safe_close = max(close, 1e-6)

        # ---------------------------------------------------------
        # 1. Trend Direction Evidence (EMA, SMA, Trend Strength)
        # ---------------------------------------------------------
        ema_12 = f.get("ema_12", 0.0)
        ema_26 = f.get("ema_26", 0.0)
        if ema_12 > 0 and ema_26 > 0:
            if ema_12 > ema_26:
                items.append(
                    EvidenceItem(
                        indicator="EMA_12_26_ALIGNMENT",
                        value=round(ema_12 - ema_26, 4),
                        condition="EMA_12 > EMA_26",
                        interpretation="Short-term exponential moving average above medium-term average indicates bullish bias.",
                        supports_state=MarketState.BULLISH_TREND,
                        weight=1.0,
                    )
                )
            elif ema_12 < ema_26:
                items.append(
                    EvidenceItem(
                        indicator="EMA_12_26_ALIGNMENT",
                        value=round(ema_12 - ema_26, 4),
                        condition="EMA_12 < EMA_26",
                        interpretation="Short-term exponential moving average below medium-term average indicates bearish bias.",
                        supports_state=MarketState.BEARISH_TREND,
                        weight=1.0,
                    )
                )

        sma_20 = f.get("sma_20", 0.0)
        sma_50 = f.get("sma_50", 0.0)
        if sma_20 > 0 and sma_50 > 0:
            if sma_20 > sma_50 and close > sma_50:
                items.append(
                    EvidenceItem(
                        indicator="SMA_20_50_ALIGNMENT",
                        value=round(sma_20 - sma_50, 4),
                        condition="SMA_20 > SMA_50 and Close > SMA_50",
                        interpretation="Price and short-term SMA above 50-period SMA confirms upward trend posture.",
                        supports_state=MarketState.BULLISH_TREND,
                        weight=1.2,
                    )
                )
            elif sma_20 < sma_50 and close < sma_50:
                items.append(
                    EvidenceItem(
                        indicator="SMA_20_50_ALIGNMENT",
                        value=round(sma_20 - sma_50, 4),
                        condition="SMA_20 < SMA_50 and Close < SMA_50",
                        interpretation="Price and short-term SMA below 50-period SMA confirms downward trend posture.",
                        supports_state=MarketState.BEARISH_TREND,
                        weight=1.2,
                    )
                )

        trend_strength = f.get("trend_strength", 0.0)
        if trend_strength >= t.trend_strength_bullish:
            items.append(
                EvidenceItem(
                    indicator="TREND_STRENGTH",
                    value=round(trend_strength, 4),
                    condition=f">= {t.trend_strength_bullish}",
                    interpretation="Positive moving average separation signals established bullish trend.",
                    supports_state=MarketState.BULLISH_TREND,
                    weight=1.0,
                )
            )
        elif trend_strength <= -t.trend_strength_bearish:
            items.append(
                EvidenceItem(
                    indicator="TREND_STRENGTH",
                    value=round(trend_strength, 4),
                    condition=f"<= -{t.trend_strength_bearish}",
                    interpretation="Negative moving average separation signals established bearish trend.",
                    supports_state=MarketState.BEARISH_TREND,
                    weight=1.0,
                )
            )
        elif abs(trend_strength) <= t.trend_strength_sideways:
            items.append(
                EvidenceItem(
                    indicator="TREND_STRENGTH",
                    value=round(trend_strength, 4),
                    condition=f"abs <= {t.trend_strength_sideways}",
                    interpretation="Moving averages tightly clustered, indicating absence of directional trend.",
                    supports_state=MarketState.SIDEWAYS,
                    weight=1.5,
                )
            )

        # ---------------------------------------------------------
        # 2. Momentum & Oscillator Evidence (RSI, MACD, Momentum)
        # ---------------------------------------------------------
        rsi = f.get("rsi_14", 50.0)
        if rsi >= t.rsi_bullish:
            items.append(
                EvidenceItem(
                    indicator="RSI_14",
                    value=round(rsi, 2),
                    condition=f">= {t.rsi_bullish}",
                    interpretation=f"RSI ({rsi:.1f}) in bullish momentum zone.",
                    supports_state=MarketState.BULLISH_TREND,
                    weight=1.0,
                )
            )
        elif rsi <= t.rsi_bearish:
            items.append(
                EvidenceItem(
                    indicator="RSI_14",
                    value=round(rsi, 2),
                    condition=f"<= {t.rsi_bearish}",
                    interpretation=f"RSI ({rsi:.1f}) in bearish momentum zone.",
                    supports_state=MarketState.BEARISH_TREND,
                    weight=1.0,
                )
            )
        elif t.rsi_sideways_low <= rsi <= t.rsi_sideways_high:
            items.append(
                EvidenceItem(
                    indicator="RSI_14",
                    value=round(rsi, 2),
                    condition=f"{t.rsi_sideways_low} <= RSI <= {t.rsi_sideways_high}",
                    interpretation="RSI hovering near 50 neutral equilibrium.",
                    supports_state=MarketState.SIDEWAYS,
                    weight=1.0,
                )
            )

        # Accumulation / Distribution RSI context
        if t.accumulation_rsi_min <= rsi <= t.accumulation_rsi_max:
            items.append(
                EvidenceItem(
                    indicator="RSI_ACCUMULATION_ZONE",
                    value=round(rsi, 2),
                    condition=f"{t.accumulation_rsi_min} <= RSI <= {t.accumulation_rsi_max}",
                    interpretation="RSI in lower accumulation base band.",
                    supports_state=MarketState.ACCUMULATION_LIKE,
                    weight=0.8,
                )
            )
        elif t.distribution_rsi_min <= rsi <= t.distribution_rsi_max:
            items.append(
                EvidenceItem(
                    indicator="RSI_DISTRIBUTION_ZONE",
                    value=round(rsi, 2),
                    condition=f"{t.distribution_rsi_min} <= RSI <= {t.distribution_rsi_max}",
                    interpretation="RSI in upper distribution band.",
                    supports_state=MarketState.DISTRIBUTION_LIKE,
                    weight=0.8,
                )
            )

        macd = f.get("macd", 0.0)
        macd_signal = f.get("macd_signal", 0.0)
        macd_hist = f.get("macd_hist", 0.0)
        if macd > macd_signal and macd_hist > 0:
            items.append(
                EvidenceItem(
                    indicator="MACD_HISTOGRAM",
                    value=round(macd_hist, 4),
                    condition="MACD > Signal and Hist > 0",
                    interpretation="Positive MACD histogram indicates upward momentum acceleration.",
                    supports_state=MarketState.BULLISH_TREND,
                    weight=1.0,
                )
            )
        elif macd < macd_signal and macd_hist < 0:
            items.append(
                EvidenceItem(
                    indicator="MACD_HISTOGRAM",
                    value=round(macd_hist, 4),
                    condition="MACD < Signal and Hist < 0",
                    interpretation="Negative MACD histogram indicates downward momentum acceleration.",
                    supports_state=MarketState.BEARISH_TREND,
                    weight=1.0,
                )
            )

        if abs(macd_hist) / safe_close <= 0.0006:
            items.append(
                EvidenceItem(
                    indicator="MACD_FLATNESS",
                    value=round(macd_hist, 6),
                    condition="|MACD_Hist| / Close <= 0.0006",
                    interpretation="Flat MACD histogram indicates balanced momentum / consolidation.",
                    supports_state=MarketState.SIDEWAYS,
                    weight=0.8,
                )
            )

        momentum_10 = f.get("momentum_10", 0.0)
        if momentum_10 >= t.momentum_bullish:
            items.append(
                EvidenceItem(
                    indicator="MOMENTUM_10",
                    value=round(momentum_10, 4),
                    condition=f">= {t.momentum_bullish}",
                    interpretation="Positive 10-period rate of change supports bullish trend persistence.",
                    supports_state=MarketState.BULLISH_TREND,
                    weight=0.8,
                )
            )
        elif momentum_10 <= -t.momentum_bearish:
            items.append(
                EvidenceItem(
                    indicator="MOMENTUM_10",
                    value=round(momentum_10, 4),
                    condition=f"<= -{t.momentum_bearish}",
                    interpretation="Negative 10-period rate of change supports bearish trend persistence.",
                    supports_state=MarketState.BEARISH_TREND,
                    weight=0.8,
                )
            )
        elif abs(momentum_10) <= t.momentum_sideways:
            items.append(
                EvidenceItem(
                    indicator="MOMENTUM_10",
                    value=round(momentum_10, 4),
                    condition=f"abs <= {t.momentum_sideways}",
                    interpretation="Negligible price momentum indicates range-bound consolidation.",
                    supports_state=MarketState.SIDEWAYS,
                    weight=0.8,
                )
            )

        # ---------------------------------------------------------
        # 3. Volatility Regime Evidence (Bollinger Bandwidth, ATR, Historical Volatility)
        # ---------------------------------------------------------
        bb_bandwidth = f.get("bb_bandwidth", 0.04)
        volatility_20 = f.get("volatility_20", 0.02)
        atr_14 = f.get("atr_14", 0.0)
        atr_pct = atr_14 / safe_close
        vol_vol_20 = f.get("volume_volatility_20", 0.15)

        # High Volatility indicators
        if bb_bandwidth >= t.bb_bandwidth_high:
            items.append(
                EvidenceItem(
                    indicator="BOLLINGER_BANDWIDTH_EXPANSION",
                    value=round(bb_bandwidth, 4),
                    condition=f"Bandwidth >= {t.bb_bandwidth_high}",
                    interpretation="Expanded Bollinger bandwidth indicates elevated price dispersion and volatility expansion.",
                    supports_state=MarketState.HIGH_VOLATILITY,
                    weight=1.8,
                )
            )
        if volatility_20 >= t.volatility_high:
            items.append(
                EvidenceItem(
                    indicator="HISTORICAL_VOLATILITY_HIGH",
                    value=round(volatility_20, 4),
                    condition=f"Vol20 >= {t.volatility_high}",
                    interpretation="20-period realized return volatility is significantly elevated.",
                    supports_state=MarketState.HIGH_VOLATILITY,
                    weight=1.8,
                )
            )
        if atr_pct >= t.atr_pct_high:
            items.append(
                EvidenceItem(
                    indicator="ATR_PERCENT_HIGH",
                    value=round(atr_pct, 4),
                    condition=f"ATR% >= {t.atr_pct_high}",
                    interpretation="Average True Range relative to price indicates wide intraday candle ranges.",
                    supports_state=MarketState.HIGH_VOLATILITY,
                    weight=1.6,
                )
            )
        if vol_vol_20 >= t.vol_volatility_high:
            items.append(
                EvidenceItem(
                    indicator="VOLUME_VOLATILITY_HIGH",
                    value=round(vol_vol_20, 4),
                    condition=f"VolVol20 >= {t.vol_volatility_high}",
                    interpretation="Turbulent turnover and volume volatility indicate erratic market participation.",
                    supports_state=MarketState.HIGH_VOLATILITY,
                    weight=1.0,
                )
            )

        # Low Volatility indicators
        if bb_bandwidth <= t.bb_bandwidth_low:
            items.append(
                EvidenceItem(
                    indicator="BOLLINGER_BANDWIDTH_COMPRESSION",
                    value=round(bb_bandwidth, 4),
                    condition=f"Bandwidth <= {t.bb_bandwidth_low}",
                    interpretation="Severe Bollinger bandwidth squeeze indicates dormant volatility preceding breakout.",
                    supports_state=MarketState.LOW_VOLATILITY,
                    weight=1.8,
                )
            )
        if volatility_20 <= t.volatility_low:
            items.append(
                EvidenceItem(
                    indicator="HISTORICAL_VOLATILITY_LOW",
                    value=round(volatility_20, 4),
                    condition=f"Vol20 <= {t.volatility_low}",
                    interpretation="20-period realized return volatility is severely compressed.",
                    supports_state=MarketState.LOW_VOLATILITY,
                    weight=1.8,
                )
            )
        if atr_pct <= t.atr_pct_low:
            items.append(
                EvidenceItem(
                    indicator="ATR_PERCENT_LOW",
                    value=round(atr_pct, 4),
                    condition=f"ATR% <= {t.atr_pct_low}",
                    interpretation="Average True Range relative to price indicates tight, compressed candle ranges.",
                    supports_state=MarketState.LOW_VOLATILITY,
                    weight=1.6,
                )
            )

        # Subdued Sideways Bandwidth (only if within normal quiet range, not an extreme squeeze)
        if t.bb_bandwidth_low < bb_bandwidth <= t.bb_bandwidth_sideways and volatility_20 < t.volatility_high:
            items.append(
                EvidenceItem(
                    indicator="BOLLINGER_BANDWIDTH_SIDEWAYS",
                    value=round(bb_bandwidth, 4),
                    condition=f"{t.bb_bandwidth_low} < Bandwidth <= {t.bb_bandwidth_sideways}",
                    interpretation="Moderate Bollinger Bandwidth consistent with standard sideways range.",
                    supports_state=MarketState.SIDEWAYS,
                    weight=0.8,
                )
            )

        # ---------------------------------------------------------
        # 4. Microstructure & Volume Dynamics (Orderbook Imbalance, Volume Change)
        # ---------------------------------------------------------
        orderbook_imbalance = f.get("orderbook_imbalance", 0.0)
        volume_change = f.get("volume_change", 0.0)
        returns = f.get("returns", 0.0)
        drawdown = f.get("drawdown", 0.0)

        if orderbook_imbalance >= t.accumulation_imbalance:
            items.append(
                EvidenceItem(
                    indicator="ORDERBOOK_IMBALANCE_BIDS",
                    value=round(orderbook_imbalance, 4),
                    condition=f">= {t.accumulation_imbalance}",
                    interpretation="Depth of market heavily skewed toward buyer bids; institutional accumulation signature.",
                    supports_state=MarketState.ACCUMULATION_LIKE,
                    weight=1.8,
                )
            )
            items.append(
                EvidenceItem(
                    indicator="ORDERBOOK_BUY_SUPPORT",
                    value=round(orderbook_imbalance, 4),
                    condition=f">= {t.accumulation_imbalance}",
                    interpretation="Bid liquidity dominance provides price floor.",
                    supports_state=MarketState.BULLISH_TREND,
                    weight=0.5,
                )
            )
        elif orderbook_imbalance <= t.distribution_imbalance:
            items.append(
                EvidenceItem(
                    indicator="ORDERBOOK_IMBALANCE_ASKS",
                    value=round(orderbook_imbalance, 4),
                    condition=f"<= {t.distribution_imbalance}",
                    interpretation="Depth of market heavily skewed toward seller asks; institutional distribution signature.",
                    supports_state=MarketState.DISTRIBUTION_LIKE,
                    weight=1.8,
                )
            )
            items.append(
                EvidenceItem(
                    indicator="ORDERBOOK_SELL_RESISTANCE",
                    value=round(orderbook_imbalance, 4),
                    condition=f"<= {t.distribution_imbalance}",
                    interpretation="Ask liquidity dominance creates overhead ceiling.",
                    supports_state=MarketState.BEARISH_TREND,
                    weight=0.5,
                )
            )

        # Volume expansion with range absorption
        if volume_change >= t.volume_expansion and abs(returns) <= 0.015:
            if orderbook_imbalance > 0:
                items.append(
                    EvidenceItem(
                        indicator="VOLUME_ABSORPTION_ACCUMULATION",
                        value=round(volume_change, 4),
                        condition=f"VolumeChange >= {t.volume_expansion} & |Returns| <= 0.015",
                        interpretation="High trading turnover without downward price progress confirms supply absorption.",
                        supports_state=MarketState.ACCUMULATION_LIKE,
                        weight=1.4,
                    )
                )
            elif orderbook_imbalance < 0:
                items.append(
                    EvidenceItem(
                        indicator="VOLUME_CHURN_DISTRIBUTION",
                        value=round(volume_change, 4),
                        condition=f"VolumeChange >= {t.volume_expansion} & |Returns| <= 0.015",
                        interpretation="High trading turnover without upward price progress indicates heavy distribution into liquidity.",
                        supports_state=MarketState.DISTRIBUTION_LIKE,
                        weight=1.4,
                    )
                )

        # Base stabilization after pullback
        if -0.15 <= drawdown <= -0.02 and momentum_10 >= -0.005:
            items.append(
                EvidenceItem(
                    indicator="DRAWDOWN_STABILIZATION",
                    value=round(drawdown, 4),
                    condition="-0.15 <= Drawdown <= -0.02 and Mom10 >= -0.005",
                    interpretation="Price stabilizing after corrective drawdown without accelerating selloff.",
                    supports_state=MarketState.ACCUMULATION_LIKE,
                    weight=1.0,
                )
            )

        return items

    def _aggregate_scores(self, evidence: List[EvidenceItem]) -> Dict[MarketState, float]:
        """Calculates total weighted evidence score per market state."""
        scores: Dict[MarketState, float] = {state: 0.0 for state in MarketState}
        for item in evidence:
            scores[item.supports_state] += item.weight
        return scores

    def _calculate_confidence(
        self,
        winner_state: MarketState,
        winner_score: float,
        runner_up_score: float,
        conflict_score: float,
    ) -> float:
        """Calculates bounded confidence metric [0.05, 0.95].

        Confidence represents quantitative evidence strength and signal alignment,
        never directional certainty or winning probability.
        """
        t = self.thresholds

        if winner_state == MarketState.UNCERTAIN:
            # For uncertain states, confidence reflects certainty in the ambiguity
            conf = 0.20 + (0.25 * conflict_score)
            return round(min(0.48, max(t.min_confidence, conf)), 4)

        # Baseline confidence from absolute evidence score and margin over alternative
        score_component = min(1.0, winner_score / 6.0)
        margin = max(0.0, winner_score - runner_up_score)
        margin_component = min(1.0, margin / max(winner_score, 1.0))

        # Base confidence ranges from 0.40 to 0.88
        base_confidence = 0.40 + (0.30 * score_component) + (0.18 * margin_component)

        # Conflict penalizes confidence
        penalized_confidence = base_confidence * (1.0 - (0.45 * conflict_score))

        # Enforce strict quantitative bounds [0.05, 0.95]
        bounded = max(t.min_confidence, min(t.max_confidence, penalized_confidence))
        return round(bounded, 4)

    def _generate_rationale(
        self,
        state: MarketState,
        confidence: float,
        scores: Dict[MarketState, float],
        evidence: List[EvidenceItem],
        conflict_detected: bool,
        conflict_score: float,
        conflict_reasons: List[str],
    ) -> str:
        """Constructs transparent human-readable quantitative synthesis."""
        supporting_items = [e for e in evidence if e.supports_state == state]
        top_indicators = ", ".join([e.indicator for e in supporting_items[:3]]) or "None"

        if state == MarketState.UNCERTAIN:
            reasons_str = "; ".join(conflict_reasons) if conflict_reasons else "Weak or contradictory signal profile across indicators."
            return (
                f"Classified as UNCERTAIN (conflict score: {conflict_score:.2f}). "
                f"Indicators exhibit material divergence: {reasons_str}"
            )

        base_rationale = (
            f"Classified as {state.value} with confidence {confidence:.2f} "
            f"based on strong quantitative evidence (score: {scores[state]:.2f}). "
            f"Primary supporting indicators: {top_indicators}."
        )

        if conflict_detected:
            base_rationale += f" Note: Divergent secondary signals detected (conflict score: {conflict_score:.2f})."

        return base_rationale

    def classify(self, snapshot: FeatureSnapshot, timeframe: str = "1h") -> MarketStateResult:
        """Evaluates quantitative feature snapshot and determines regime with bounded confidence."""
        t = self.thresholds
        features = snapshot.features

        # 1. Generate evidence items
        evidence = self._evaluate_evidence(features)

        # 2. Aggregate scores
        scores = self._aggregate_scores(evidence)

        # 3. Detect and quantify conflicts
        conflict_detected, conflict_score, conflict_reasons = ConflictAnalyzer.analyze_conflicts(
            features, scores, evidence
        )

        # 4. Rank regimes by score
        ranked_regimes = sorted(
            [(state, score) for state, score in scores.items() if state != MarketState.UNCERTAIN],
            key=lambda x: x[1],
            reverse=True,
        )

        top_state, top_score = ranked_regimes[0]
        second_state, second_score = ranked_regimes[1] if len(ranked_regimes) > 1 else (MarketState.UNCERTAIN, 0.0)

        # 5. Regime Selection & Conflict Arbitration
        state_scores_dict = {state.value: round(score, 4) for state, score in scores.items()}

        final_state: MarketState
        if top_score < t.min_evidence_score:
            # Insufficient evidence for any structured regime
            final_state = MarketState.UNCERTAIN
            scores[MarketState.UNCERTAIN] = 3.0
            state_scores_dict[MarketState.UNCERTAIN.value] = 3.0
        elif conflict_detected and (top_score - second_score) < t.uncertainty_margin:
            # Significant conflict with narrow margin between conflicting regimes
            final_state = MarketState.UNCERTAIN
            scores[MarketState.UNCERTAIN] = round(conflict_score * 4.0, 2)
            state_scores_dict[MarketState.UNCERTAIN.value] = scores[MarketState.UNCERTAIN]
        else:
            final_state = top_state

        # 6. Bounded Confidence
        confidence = self._calculate_confidence(
            winner_state=final_state,
            winner_score=top_score,
            runner_up_score=second_score,
            conflict_score=conflict_score,
        )

        # 7. Narrative Rationale
        primary_rationale = self._generate_rationale(
            state=final_state,
            confidence=confidence,
            scores=scores,
            evidence=evidence,
            conflict_detected=conflict_detected,
            conflict_score=conflict_score,
            conflict_reasons=conflict_reasons,
        )

        return MarketStateResult(
            symbol=snapshot.symbol,
            timestamp=snapshot.timestamp,
            state=final_state,
            confidence=confidence,
            primary_rationale=primary_rationale,
            conflict_detected=conflict_detected,
            conflict_score=conflict_score,
            evidence=evidence,
            state_scores=state_scores_dict,
            timeframe=timeframe,
            warmup_periods_used=snapshot.warmup_periods_used,
        )
