"""Signal aggregator ensemble combining individual strategies with diversity and domination guards."""

from collections import Counter
from typing import Any, Dict, List, Optional

from app.schemas.features import FeatureSnapshot
from app.schemas.market_state import MarketState, MarketStateResult
from app.schemas.signals import (
    AggregatedSignalResult,
    SignalDirection,
    StrategySignal,
    TimeHorizon,
)
from app.services.signal_engine.base import BaseStrategy
from app.services.signal_engine.mean_reversion import MeanReversionStrategy
from app.services.signal_engine.ml_signal import MultiFactorMLStrategy
from app.services.signal_engine.momentum import MomentumStrategy
from app.services.signal_engine.technical import TechnicalStrategy
from app.services.signal_engine.volatility import VolatilityStrategy

# No single model is permitted to exert more than 35% of total ensemble weight
MAX_STRATEGY_WEIGHT_SHARE = 0.35


class SignalAggregator:
    """Combines heterogeneous strategy models with regime conditioning and explainability."""

    def __init__(self, strategies: Optional[List[BaseStrategy]] = None) -> None:
        self.strategies: List[BaseStrategy] = strategies or [
            TechnicalStrategy(weight=1.0),
            MomentumStrategy(weight=1.0),
            MeanReversionStrategy(weight=1.0),
            VolatilityStrategy(weight=1.0),
            MultiFactorMLStrategy(weight=1.0),
        ]

    def _get_regime_weights(self, market_state: Optional[MarketStateResult]) -> Dict[str, float]:
        """Calculates adaptive strategy weights conditioned on current macro market regime."""
        weights = {s.name: s.weight for s in self.strategies}

        if market_state:
            regime = market_state.state

            if regime in (MarketState.BULLISH_TREND, MarketState.BEARISH_TREND):
                # Prioritize trend and momentum; discount counter-trend mean-reversion
                if "TechnicalStrategy" in weights:
                    weights["TechnicalStrategy"] *= 1.30
                if "MomentumStrategy" in weights:
                    weights["MomentumStrategy"] *= 1.25
                if "MeanReversionStrategy" in weights:
                    weights["MeanReversionStrategy"] *= 0.50
            elif regime == MarketState.SIDEWAYS:
                # Prioritize mean reversion in range markets
                if "MeanReversionStrategy" in weights:
                    weights["MeanReversionStrategy"] *= 1.40
                if "TechnicalStrategy" in weights:
                    weights["TechnicalStrategy"] *= 0.70
                if "MomentumStrategy" in weights:
                    weights["MomentumStrategy"] *= 0.70
            elif regime == MarketState.HIGH_VOLATILITY:
                # Prioritize volatility defense
                if "VolatilityStrategy" in weights:
                    weights["VolatilityStrategy"] *= 1.50
                if "TechnicalStrategy" in weights:
                    weights["TechnicalStrategy"] *= 0.75
                if "MomentumStrategy" in weights:
                    weights["MomentumStrategy"] *= 0.75
            elif regime == MarketState.LOW_VOLATILITY:
                # Prioritize breakout preparation
                if "VolatilityStrategy" in weights:
                    weights["VolatilityStrategy"] *= 1.30
                if "MomentumStrategy" in weights:
                    weights["MomentumStrategy"] *= 1.20
            elif regime == MarketState.UNCERTAIN:
                # Discount high-conviction models when macro environment is ambiguous
                for name in weights:
                    weights[name] *= 0.85

        # Enforce diversity constraint: no single strategy can exceed MAX_STRATEGY_WEIGHT_SHARE of total weight
        if len(weights) > 1:
            cap_ratio = MAX_STRATEGY_WEIGHT_SHARE / (1.0 - MAX_STRATEGY_WEIGHT_SHARE)
            for name in list(weights.keys()):
                other_sum = sum(v for k, v in weights.items() if k != name)
                max_allowed = cap_ratio * other_sum
                if weights[name] > max_allowed:
                    weights[name] = max_allowed

        return weights

    def aggregate(
        self,
        snapshot: FeatureSnapshot,
        market_state: Optional[MarketStateResult] = None,
        timeframe: str = "1h",
    ) -> AggregatedSignalResult:
        """Runs all strategies and aggregates individual signals into an explainable consensus."""
        # 1. Collect individual signals
        strategy_signals: List[StrategySignal] = []
        for strategy in self.strategies:
            sig = strategy.generate_signal(snapshot=snapshot, market_state=market_state)
            strategy_signals.append(sig)

        # 2. Retrieve regime-conditioned strategy weights
        effective_weights = self._get_regime_weights(market_state)

        # 3. Aggregate directional scores
        direction_scores: Dict[SignalDirection, float] = {d: 0.0 for d in SignalDirection}
        direction_vote_counts: Dict[str, int] = {d.value: 0 for d in SignalDirection}

        for sig in strategy_signals:
            w = effective_weights.get(sig.strategy_name, 1.0)
            weighted_points = w * sig.strength * sig.confidence
            direction_scores[sig.direction] += weighted_points
            direction_vote_counts[sig.direction.value] += 1

        # 4. Determine winning consensus direction
        ranked_directions = sorted(direction_scores.items(), key=lambda x: x[1], reverse=True)
        winner_direction, winner_score = ranked_directions[0]
        runner_up_direction, runner_up_score = ranked_directions[1]

        total_score = sum(direction_scores.values())
        agreeing_signals = [s for s in strategy_signals if s.direction == winner_direction]
        agreement_ratio = len(agreeing_signals) / max(len(strategy_signals), 1)

        # 5. Handle tie-breaks or flat conditions
        final_direction = winner_direction
        if winner_score < 0.20 or (winner_score - runner_up_score < 0.10 and winner_direction != runner_up_direction):
            if market_state and market_state.state in (MarketState.HIGH_VOLATILITY, MarketState.SIDEWAYS):
                final_direction = SignalDirection.HOLD
            else:
                final_direction = SignalDirection.NEUTRAL

        # 6. Calculate Bounded Confidence and Strength
        # Base confidence driven by agreement ratio and margin over opposing direction
        margin = max(0.0, winner_score - runner_up_score)
        margin_pct = margin / max(winner_score, 1.0)

        base_conf = 0.42 + (0.32 * agreement_ratio) + (0.16 * min(1.0, margin_pct))

        # Regime conflict penalty if applicable
        regime_penalty = 0.0
        if market_state and market_state.conflict_detected:
            regime_penalty = 0.35 * market_state.conflict_score
        elif market_state and market_state.state == MarketState.UNCERTAIN:
            regime_penalty = 0.20

        raw_conf = base_conf * (1.0 - regime_penalty)
        final_confidence = round(max(0.05, min(0.95, raw_conf)), 4)

        # Strength: weighted average strength of agreeing strategies
        if agreeing_signals:
            avg_strength = sum(s.strength for s in agreeing_signals) / len(agreeing_signals)
            final_strength = round(max(0.0, min(1.0, avg_strength * agreement_ratio)), 4)
        else:
            final_strength = 0.10

        # 7. Synthesize Transparent Consensus Reasons
        reasons: List[str] = [
            f"Consensus: {len(agreeing_signals)} of {len(strategy_signals)} strategies align on {final_direction.value} "
            f"(agreement ratio: {agreement_ratio:.0%})",
        ]
        if agreeing_signals:
            contributing_names = ", ".join(s.strategy_name for s in agreeing_signals)
            reasons.append(f"Contributing strategies: {contributing_names}")
            # Collect top 2 specific reasons from agreeing strategies
            for s in agreeing_signals[:2]:
                if s.reasons:
                    reasons.append(f"{s.strategy_name}: {s.reasons[0]}")

        if regime_penalty > 0:
            reasons.append(f"Regime caution applied: macro regime is {market_state.state.value if market_state else 'UNCERTAIN'}")

        # 8. Consensus Metadata
        consensus_metrics = {
            "vote_counts": direction_vote_counts,
            "direction_scores": {d.value: round(s, 4) for d, s in direction_scores.items()},
            "agreement_ratio": round(agreement_ratio, 4),
            "strategies_evaluated": len(strategy_signals),
            "effective_weights": {k: round(v, 4) for k, v in effective_weights.items()},
        }

        # 9. Time horizon recommendation
        time_horizon = TimeHorizon.SHORT_TERM
        if final_direction in (SignalDirection.LONG, SignalDirection.SHORT) and agreement_ratio >= 0.80:
            time_horizon = TimeHorizon.MEDIUM_TERM

        # 10. Calibrated Qualitative Evidence Strength (No Fake Confidence Percentage)
        if agreement_ratio >= 0.75 and final_strength >= 0.60:
            evidence_strength = "Strong"
        elif agreement_ratio >= 0.50 and final_strength >= 0.35:
            evidence_strength = "Moderate"
        elif final_strength >= 0.15:
            evidence_strength = "Weak"
        else:
            evidence_strength = "Insufficient"

        # 11. Traceable Evidence Extraction
        feats = snapshot.features
        close_px = float(feats.get("close", 0.0))
        rsi_val = float(feats.get("rsi_14", 50.0))
        macd_val = float(feats.get("macd", 0.0))
        macd_sig_val = float(feats.get("macd_signal", 0.0))
        macd_hist_val = float(feats.get("macd_hist", 0.0))
        sma_20 = float(feats.get("sma_20", close_px))
        sma_50 = float(feats.get("sma_50", close_px))
        ema_12 = float(feats.get("ema_12", close_px))
        ema_26 = float(feats.get("ema_26", close_px))
        vol_ratio = float(feats.get("volume_ratio_20", 1.0))
        atr_14 = float(feats.get("atr_14", close_px * 0.015))
        bb_bandwidth = float(feats.get("bb_bandwidth", 0.04))

        # Momentum
        if rsi_val >= 60.0 and macd_hist_val > 0:
            mom_status = "Positive momentum"
            mom_obs = f"RSI at {rsi_val:.1f} shows solid buying impulse; MACD histogram expanding ({macd_hist_val:+.4f})."
        elif rsi_val <= 40.0 and macd_hist_val < 0:
            mom_status = "Negative momentum"
            mom_obs = f"RSI at {rsi_val:.1f} reflects seller pressure; MACD histogram declining ({macd_hist_val:+.4f})."
        else:
            mom_status = "Neutral / Rotational"
            mom_obs = f"RSI at {rsi_val:.1f} near centerline; MACD neutral ({macd_hist_val:+.4f})."

        # Trend
        if close_px >= sma_20 and sma_20 >= sma_50:
            trend_status = "Bullish alignment"
            trend_obs = f"Price (${close_px:,.2f}) maintains above 20 SMA (${sma_20:,.2f}) and 50 SMA (${sma_50:,.2f})."
        elif close_px <= sma_20 and sma_20 <= sma_50:
            trend_status = "Bearish alignment"
            trend_obs = f"Price (${close_px:,.2f}) trades below 20 SMA (${sma_20:,.2f}) and 50 SMA (${sma_50:,.2f})."
        else:
            trend_status = "Consolidation / Mixed"
            trend_obs = f"Price (${close_px:,.2f}) fluctuating between 20 SMA (${sma_20:,.2f}) and 50 SMA (${sma_50:,.2f})."

        # Volume
        if vol_ratio >= 1.2:
            vol_status = "Expanding participation"
            vol_obs = f"Recent volume is {vol_ratio:.1f}x higher than the 20-period average baseline."
        elif vol_ratio <= 0.8:
            vol_status = "Contracting participation"
            vol_obs = f"Volume is contracting ({vol_ratio:.1f}x of 20-period average)."
        else:
            vol_status = "Average turnover"
            vol_obs = f"Volume is tracking in line with recent historical levels ({vol_ratio:.1f}x)."

        # Volatility
        if bb_bandwidth >= 0.06:
            volat_status = "High / Expanding"
            volat_obs = f"Bollinger bandwidth expanded ({bb_bandwidth * 100:.1f}%) with ATR at ${atr_14:,.2f}."
        elif bb_bandwidth <= 0.025:
            volat_status = "Low / Compression"
            volat_obs = f"Volatility is heavily compressed ({bb_bandwidth * 100:.1f}% bandwidth). Potential breakout pending."
        else:
            volat_status = "Moderate"
            volat_obs = f"Normal volatility regime with ATR at ${atr_14:,.2f} and bandwidth at {bb_bandwidth * 100:.1f}%."

        evidence_summary = {
            "momentum": {
                "status": mom_status,
                "rsi": round(rsi_val, 1),
                "macd_histogram": round(macd_hist_val, 4),
                "observation": mom_obs,
            },
            "trend": {
                "status": trend_status,
                "price": round(close_px, 2),
                "sma_20": round(sma_20, 2),
                "sma_50": round(sma_50, 2),
                "observation": trend_obs,
            },
            "volume": {
                "status": vol_status,
                "ratio": round(vol_ratio, 2),
                "observation": vol_obs,
            },
            "volatility": {
                "status": volat_status,
                "atr": round(atr_14, 2),
                "bandwidth_pct": round(bb_bandwidth * 100, 2),
                "observation": volat_obs,
            },
        }

        # 12. Invalidation Criteria
        if final_direction == SignalDirection.LONG:
            what_could_invalidate = [
                f"Sustained candle close below the 20 SMA (${sma_20:,.2f}).",
                "RSI breaking down and closing beneath the 50.0 neutral threshold.",
                "Abrupt expansion of selling volume exceeding 1.5x average.",
            ]
        elif final_direction == SignalDirection.SHORT:
            what_could_invalidate = [
                f"Sustained candle close above the 20 SMA (${sma_20:,.2f}).",
                "Bullish MACD crossover with RSI reclaiming 50.0.",
                "High-volume breakout above recent resistance levels.",
            ]
        else:
            what_could_invalidate = [
                f"Decisive breakout above 50 SMA (${sma_50:,.2f}) with expanding volume.",
                f"Breakdown and close below local support envelope.",
                "Volatility expansion from current compression.",
            ]

        freshness = {
            "source": "Binance Spot",
            "symbol": snapshot.symbol,
            "timeframe": timeframe,
            "market_data_timestamp": snapshot.timestamp.isoformat(),
            "is_stale": False,
        }

        return AggregatedSignalResult(
            asset=snapshot.symbol,
            timestamp=snapshot.timestamp,
            direction=final_direction,
            confidence=final_confidence,
            strength=final_strength,
            time_horizon=time_horizon,
            market_state=market_state.state.value if market_state else None,
            reasons=reasons,
            strategy_signals=strategy_signals,
            consensus_metrics=consensus_metrics,
            timeframe=timeframe,
            model_version="v1.0",
            evidence_strength=evidence_strength,
            evidence_summary=evidence_summary,
            what_could_invalidate=what_could_invalidate,
            freshness=freshness,
        )
