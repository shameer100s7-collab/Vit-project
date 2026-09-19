"""Probabilistic participant flow model and behavioral state classification."""

from typing import Dict, List, Tuple

from app.schemas.behavior import (
    BehaviorState,
    LiquidityPressure,
    ObservationItem,
    ParticipantArchetype,
    WhaleActivityIndicator,
)
from app.schemas.features import FeatureSnapshot


class ParticipantModel:
    """Infers probabilistic participant archetypes and behavioral regimes from observable footprints."""

    @staticmethod
    def infer_behavior(
        snapshot: FeatureSnapshot,
        liquidity: LiquidityPressure,
        whale: WhaleActivityIndicator,
        observations: List[ObservationItem],
    ) -> Tuple[BehaviorState, float, ParticipantArchetype, Dict[str, float], str]:
        """Synthesizes observable footprints into a probabilistic participant classification.

        Returns:
            Tuple of (behavior_state, confidence in [0.05, 0.95], primary_archetype, probability_breakdown, summary).
        """
        f = snapshot.features

        rsi = f.get("rsi_14", 50.0)
        drawdown = f.get("drawdown", 0.0)
        returns = f.get("returns", 0.0)
        trend_strength = f.get("trend_strength", 0.0)
        volatility_20 = f.get("volatility_20", 0.02)
        volume_change = f.get("volume_change", 0.0)

        # -----------------------------------------------------------------
        # 1. Score Behavioral Archetypes
        # -----------------------------------------------------------------
        scores: Dict[ParticipantArchetype, float] = {
            arch: 0.20 for arch in ParticipantArchetype
        }

        # Institutional Accumulation vs Distribution
        if liquidity.net_imbalance > 0.20 and (whale.absorption_ratio > 1.2 or volume_change > 0.10):
            scores[ParticipantArchetype.INSTITUTIONAL_ACCUMULATION] += 1.6
            scores[ParticipantArchetype.WHALE_PASSIVE_ABSORPTION] += 1.2
        elif liquidity.net_imbalance < -0.20 and (whale.absorption_ratio > 1.2 or volume_change > 0.10):
            scores[ParticipantArchetype.INSTITUTIONAL_DISTRIBUTION] += 1.6
            scores[ParticipantArchetype.WHALE_PASSIVE_ABSORPTION] += 1.2

        # Whale Wall Presence
        if whale.wall_detected:
            scores[ParticipantArchetype.WHALE_PASSIVE_ABSORPTION] += 1.5
            if whale.wall_side == "BID":
                scores[ParticipantArchetype.INSTITUTIONAL_ACCUMULATION] += 0.8
            elif whale.wall_side == "ASK":
                scores[ParticipantArchetype.INSTITUTIONAL_DISTRIBUTION] += 0.8

        # Retail FOMO vs Panic
        if rsi >= 70.0 and returns > 0.02 and volatility_20 > 0.03:
            scores[ParticipantArchetype.RETAIL_DOMINATED] += 1.8
        elif rsi <= 30.0 and returns < -0.02 and drawdown < -0.05:
            scores[ParticipantArchetype.RETAIL_DOMINATED] += 1.8

        # Liquidity Provider / Market Making
        if liquidity.spread_bps <= 4.5 and abs(liquidity.net_imbalance) <= 0.15 and volatility_20 < 0.025:
            scores[ParticipantArchetype.LIQUIDITY_PROVIDER_ACTIVE] += 1.6
            scores[ParticipantArchetype.ALGORITHMIC_HIGH_FREQUENCY] += 1.2

        # Algorithmic High Frequency
        if liquidity.spread_bps <= 3.5 and abs(returns) < 0.005:
            scores[ParticipantArchetype.ALGORITHMIC_HIGH_FREQUENCY] += 1.2

        # -----------------------------------------------------------------
        # 2. Normalize Archetype Probabilities
        # -----------------------------------------------------------------
        total_score = sum(scores.values())
        probabilities = {
            arch.value: round(score / total_score, 4)
            for arch, score in scores.items()
        }

        # Identify primary archetype
        sorted_archetypes = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        primary_archetype, top_score = sorted_archetypes[0]
        runner_up_archetype, second_score = sorted_archetypes[1]

        # -----------------------------------------------------------------
        # 3. Determine Behavioral State
        # -----------------------------------------------------------------
        state: BehaviorState
        if primary_archetype == ParticipantArchetype.INSTITUTIONAL_ACCUMULATION or (
            primary_archetype == ParticipantArchetype.WHALE_PASSIVE_ABSORPTION and liquidity.net_imbalance > 0.15
        ):
            state = BehaviorState.ACCUMULATION_LIKE

        elif primary_archetype == ParticipantArchetype.INSTITUTIONAL_DISTRIBUTION or (
            primary_archetype == ParticipantArchetype.WHALE_PASSIVE_ABSORPTION and liquidity.net_imbalance < -0.15
        ):
            state = BehaviorState.DISTRIBUTION_LIKE

        elif primary_archetype == ParticipantArchetype.RETAIL_DOMINATED and rsi >= 65.0:
            state = BehaviorState.RETAIL_FOMO

        elif primary_archetype == ParticipantArchetype.RETAIL_DOMINATED and rsi <= 35.0:
            state = BehaviorState.RETAIL_PANIC

        elif whale.concentration_score > 0.60 and abs(returns) < 0.008 and volume_change > 0.25:
            state = BehaviorState.LIQUIDITY_HUNTING

        elif primary_archetype in (
            ParticipantArchetype.LIQUIDITY_PROVIDER_ACTIVE,
            ParticipantArchetype.ALGORITHMIC_HIGH_FREQUENCY,
        ):
            state = BehaviorState.MARKET_MAKING_BALANCED

        elif total_score < 1.8:
            state = BehaviorState.NEUTRAL_INACTIVE

        else:
            state = BehaviorState.UNCERTAIN

        # -----------------------------------------------------------------
        # 4. Calibrate Bounded Confidence [0.05, 0.95]
        # -----------------------------------------------------------------
        prob_lead = probabilities[primary_archetype.value] - probabilities[runner_up_archetype.value]
        base_confidence = 0.45 + (0.35 * probabilities[primary_archetype.value]) + (0.20 * min(1.0, prob_lead * 2.5))

        if state == BehaviorState.UNCERTAIN:
            final_confidence = 0.25
        else:
            final_confidence = round(max(0.05, min(0.95, base_confidence)), 4)

        # -----------------------------------------------------------------
        # 5. Synthesize Objective Explanatory Summary
        # -----------------------------------------------------------------
        summary = (
            f"Observable market footprints suggest {state.value} regime with {final_confidence:.0%} confidence. "
            f"Primary flow footprint attributed to {primary_archetype.value} "
            f"(probability: {probabilities[primary_archetype.value]:.1%}). "
            f"Order book displays {liquidity.depth_resilience.lower()} depth with "
            f"{liquidity.net_imbalance:+.1%} net imbalance and {liquidity.spread_bps:.1f} bps spread."
        )

        return state, final_confidence, primary_archetype, probabilities, summary
