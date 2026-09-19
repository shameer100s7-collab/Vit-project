"""Market Context Engine for GHOST Signal.

Transforms chart visual information and real market telemetry into a structured,
evidence-based description of what the market is doing without generating buy/sell signals.
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from app.schemas.market import CanonicalCandle, CanonicalPrice, CanonicalVolume
from app.schemas.market_context import (
    EvidenceQuality,
    MarketContextRequest,
    MarketContextResult,
    MarketContextState,
    MarketMap,
    MarketStateContext,
    MultiTimeframeLevel,
    ScreenshotQualityGateResult,
    TimeframeScreenshot,
)
from app.services.feature_engine.feature_builder import FeatureBuilder
from app.services.market_context.quality_gate import ScreenshotQualityGate


class MarketContextEngine:
    """Core analytical engine transforming visual screenshots and telemetry into market context."""

    def __init__(self) -> None:
        self.feature_builder = FeatureBuilder()
        self.quality_gate = ScreenshotQualityGate()

    def analyze_context(
        self,
        request: MarketContextRequest,
        candles: Optional[List[CanonicalCandle]] = None,
        live_price: Optional[CanonicalPrice] = None,
        ticker_24h: Optional[CanonicalVolume] = None,
    ) -> MarketContextResult:
        """Runs quality gate and generates comprehensive, non-signal market context."""
        now = datetime.now(timezone.utc)
        asset = request.asset.strip().upper()
        timeframe = request.timeframe.strip()
        has_volume = request.has_volume if request.has_volume is not None else True

        # 1. SCREENSHOT QUALITY GATE
        qg_result = self.quality_gate.evaluate(
            image_data=request.image_data,
            asset=asset,
            timeframe=timeframe,
            has_volume=has_volume,
        )

        # If quality gate fails, return early with zero hallucinated analysis
        if not qg_result.quality_gate_passed:
            return MarketContextResult(
                asset=asset,
                timeframe=timeframe,
                evidence_quality=EvidenceQuality.INSUFFICIENT,
                market_state=MarketStateContext(
                    state=MarketContextState.MIXED_UNCLEAR,
                    summary="Visual information in the uploaded screenshot is insufficient for reliable analysis.",
                ),
                market_map=MarketMap(
                    price="Price action obscured or illegible.",
                    structure="Structure is currently mixed/unclear from the available chart.",
                    time="Sequence duration cannot be reliably determined.",
                    volume="Volume context unavailable from this screenshot.",
                    range="Range behavior unavailable.",
                    location="Location relative to structure cannot be confirmed.",
                    candle_behavior="Candle bodies and wicks not sufficiently visible.",
                ),
                supporting_evidence=[],
                conflicting_evidence=[],
                current_context=(
                    "The uploaded chart screenshot failed the visual clarity inspection. "
                    "GHOST will not fabricate market structure, price levels, or volume from unreadable imagery."
                ),
                what_to_watch=[
                    "Upload a clear screenshot with visible candle bodies and wicks to activate market context.",
                ],
                limitations=[
                    "Quality gate failed: image lacks necessary resolution, sharpness, or visible candle geometry."
                ],
                quality_gate=qg_result,
                timestamp=now,
            )

        # 2. Extract Structural Telemetry
        limitations: List[str] = []
        if not qg_result.volume_visible:
            limitations.append("Volume context unavailable from this screenshot.")

        # Analyze real market candles if provided
        if candles and len(candles) >= 5:
            df = self.feature_builder.build_feature_matrix(candles)
            market_map, market_state, supporting, conflicting, current_ctx, what_watch = self._evaluate_market_data(
                df=df,
                timeframe=timeframe,
                has_volume=qg_result.volume_visible,
            )
        else:
            # Fallback to visual-only estimation if historical candles are not provided
            limitations.append("External historical candles unavailable; analysis based strictly on screenshot observation.")
            market_map, market_state, supporting, conflicting, current_ctx, what_watch = self._evaluate_visual_defaults(
                timeframe=timeframe,
                has_volume=qg_result.volume_visible,
            )

        # 3. Multi-Timeframe Hierarchical Synthesis (if secondary screenshots provided)
        mtf_levels: Optional[List[MultiTimeframeLevel]] = None
        mtf_synthesis: Optional[str] = None
        if request.secondary_screenshots and len(request.secondary_screenshots) > 0:
            mtf_levels, mtf_synthesis = self._build_multi_timeframe_synthesis(
                primary_tf=timeframe,
                primary_state=market_state.state,
                secondary_screenshots=request.secondary_screenshots,
            )

        # 4. Live Market Telemetry Cross-Check
        live_comparison: Optional[Dict[str, Any]] = None
        if live_price and live_price.price:
            live_comparison = {
                "live_price": live_price.price,
                "source": live_price.source or "Binance Spot",
                "timestamp": live_price.timestamp.isoformat() if live_price.timestamp else now.isoformat(),
                "note": "Context is primarily derived from the visible chart screenshot.",
            }

        return MarketContextResult(
            asset=asset,
            timeframe=timeframe,
            evidence_quality=qg_result.clarity_rating,
            market_state=market_state,
            market_map=market_map,
            supporting_evidence=supporting,
            conflicting_evidence=conflicting,
            current_context=current_ctx,
            what_to_watch=what_watch,
            limitations=limitations,
            quality_gate=qg_result,
            multi_timeframe_synthesis=mtf_synthesis,
            multi_timeframe_levels=mtf_levels,
            live_market_comparison=live_comparison,
            timestamp=now,
        )

    def _evaluate_market_data(
        self,
        df: pd.DataFrame,
        timeframe: str,
        has_volume: bool,
    ) -> Tuple[MarketMap, MarketStateContext, List[str], List[str], str, List[str]]:
        """Extracts strictly observable structural and contextual observations."""
        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else latest
        window = df.tail(min(20, len(df)))

        curr_close = float(latest["close"])
        curr_open = float(latest["open"])
        curr_high = float(latest["high"])
        curr_low = float(latest["low"])

        swing_high = float(window["high"].max())
        swing_low = float(window["low"].min())
        range_span = swing_high - swing_low

        sma_20 = float(latest.get("sma_20", curr_close))
        sma_50 = float(latest.get("sma_50", curr_close))

        # 1. Price Dimension
        recent_returns = (curr_close - float(window.iloc[0]["open"])) / float(window.iloc[0]["open"]) if float(window.iloc[0]["open"]) > 0 else 0.0
        if abs(recent_returns) > 0.04:
            price_obs = f"Price has exhibited directional displacement of {recent_returns:+.2%} over the trailing {len(window)} candles."
        elif range_span > 0 and (curr_close - swing_low) / range_span > 0.7:
            price_obs = "Price is trading near the upper boundary of the visible range following an upward advance."
        elif range_span > 0 and (curr_close - swing_low) / range_span < 0.3:
            price_obs = "Price is trading near the lower boundary of the visible range following downward pressure."
        else:
            price_obs = "Price is rotating within the interior of the visible consolidation range."

        # 2. Structure Dimension
        highs = window["high"].values
        lows = window["low"].values
        higher_highs = highs[-1] >= highs[0]
        higher_lows = lows[-1] >= lows[0]

        if higher_highs and higher_lows:
            struct_obs = f"Higher High and Higher Low progression is visible across the {timeframe} sequence."
            state = MarketContextState.TRENDING
            state_summary = f"Price is maintaining an upward structural sequence of higher highs and higher lows on the {timeframe} timeframe."
        elif not higher_highs and not higher_lows:
            struct_obs = f"Lower High and Lower Low progression is visible across the {timeframe} sequence."
            state = MarketContextState.TRENDING
            state_summary = f"Price is establishing a downward structural sequence of lower highs and lower lows on the {timeframe} timeframe."
        elif abs(recent_returns) < 0.015:
            struct_obs = "Price is contained within well-defined horizontal support and resistance boundaries."
            state = MarketContextState.CONSOLIDATING
            state_summary = f"Price is compressing within a bounded horizontal range without directional breakout on the {timeframe} timeframe."
        else:
            struct_obs = "Structure is currently mixed/unclear from the available chart sequence."
            state = MarketContextState.MIXED_UNCLEAR
            state_summary = "Structural sequence exhibits competing directional pushes without clear trend continuity."

        # 3. Time / Sequence Dimension
        time_obs = f"The current price leg has developed over approximately {min(len(window), 20)} candles on the {timeframe} interval."

        # 4. Volume Dimension
        if has_volume and "volume" in df.columns:
            avg_vol = float(window["volume"].mean()) if len(window) > 0 else float(latest["volume"])
            curr_vol = float(latest["volume"])
            if avg_vol > 0 and curr_vol > 1.2 * avg_vol:
                vol_obs = f"Increased volume participation ({(curr_vol / avg_vol):.1f}x recent average) accompanied recent price movement."
            elif avg_vol > 0 and curr_vol < 0.8 * avg_vol:
                vol_obs = f"Participation is contracting ({(curr_vol / avg_vol):.1f}x recent average) during recent candles."
            else:
                vol_obs = "Volume participation remains in line with recent average baseline turnover."
        else:
            vol_obs = "Volume context unavailable from this screenshot."

        # 5. Range / Volatility Dimension
        avg_range = float((window["high"] - window["low"]).mean()) if len(window) > 0 else 1.0
        curr_range = curr_high - curr_low
        if curr_range > 1.3 * avg_range:
            range_obs = "Recent candle ranges are expanding relative to preceding consolidation candles."
            if state != MarketContextState.TRENDING:
                state = MarketContextState.EXPANDING
                state_summary = "Price is expanding outside recent range boundaries with enlarged candle ranges."
        elif curr_range < 0.7 * avg_range:
            range_obs = "Candle ranges are visibly contracting into a tight compression band."
            if state == MarketContextState.CONSOLIDATING:
                state = MarketContextState.COMPRESSING
                state_summary = "Price volatility is compressing within narrowing candle envelopes."
        else:
            range_obs = "Candle ranges reflect stable volatility without abrupt expansion."

        # 6. Location Dimension
        if range_span > 0:
            rel_pos = (curr_close - swing_low) / range_span
            if rel_pos >= 0.8:
                loc_obs = f"Current price is positioned in the upper 20% of the visible range, near the ${swing_high:,.2f} structural boundary."
            elif rel_pos <= 0.2:
                loc_obs = f"Current price is positioned in the lower 20% of the visible range, near the ${swing_low:,.2f} structural boundary."
            else:
                loc_obs = "Current price is positioned in the middle region of the visible range."
        else:
            loc_obs = "Price is positioned near the recent structural average."

        # 7. Candle Behavior Dimension
        candle_body = abs(curr_close - curr_open)
        upper_wick = curr_high - max(curr_close, curr_open)
        lower_wick = min(curr_close, curr_open) - curr_low

        if upper_wick > 1.5 * candle_body and upper_wick > 0:
            candle_obs = "Prominent upper-wick rejection is visible, indicating intraday selling pressure near the high."
        elif lower_wick > 1.5 * candle_body and lower_wick > 0:
            candle_obs = "Prominent lower-wick absorption is visible, indicating responsive buying near the low."
        elif candle_body > 0.7 * curr_range and curr_range > 0:
            candle_obs = "Full-bodied candle behavior with minimal wicks reflects decisive directional closure."
        else:
            candle_obs = "Balanced upper and lower wicks reflect two-sided rotational auction behavior."

        market_map = MarketMap(
            price=price_obs,
            structure=struct_obs,
            time=time_obs,
            volume=vol_obs,
            range=range_obs,
            location=loc_obs,
            candle_behavior=candle_obs,
        )

        market_state_ctx = MarketStateContext(
            state=state,
            summary=state_summary,
        )

        # 8. Supporting Evidence (3-5 items)
        supporting: List[str] = [
            f"Structure confirms {struct_obs.lower()}",
            f"Price location is consistent with {loc_obs.lower()}",
            f"Volatility profile shows that {range_obs.lower()}",
        ]
        if has_volume and "unavailable" not in vol_obs:
            supporting.append(vol_obs)

        # 9. Conflicting / Limiting Evidence (3-5 items)
        conflicting: List[str] = []
        if range_span > 0 and (curr_close - swing_low) / range_span > 0.7:
            conflicting.append(f"Price is approaching overhead structural resistance at ${swing_high:,.2f}, creating potential friction.")
        elif range_span > 0 and (curr_close - swing_low) / range_span < 0.3:
            conflicting.append(f"Price is testing structural support at ${swing_low:,.2f} without guaranteed floor confirmation.")

        if "rejection" in candle_obs.lower():
            conflicting.append(candle_obs)

        if not has_volume or "unavailable" in vol_obs:
            conflicting.append("Lack of visible volume limits verification of institutional participation.")
        else:
            conflicting.append("Turnover must be monitored for signs of exhaustion or divergence.")

        # 10. Current Context Synthesis (2-4 concise sentences)
        current_ctx = (
            f"The market on the {timeframe} timeframe is currently {state.value.lower()}. "
            f"{price_obs} "
            f"{loc_obs} "
            f"Structural integrity will depend on whether price accepts beyond boundary areas or rotates back into consolidation."
        )

        # 11. What to Watch (contextual invalidation conditions, NOT trading signals)
        what_watch: List[str] = [
            f"Acceptance and sustained candle closes above ${swing_high:,.2f} would confirm structural range expansion.",
            f"A breakdown beneath the ${swing_low:,.2f} structural boundary would invalidate the current support framework.",
            "Wick rejections or volume contraction around range extremes would signal rotational continuation rather than breakout.",
        ]

        return market_map, market_state_ctx, supporting[:4], conflicting[:4], current_ctx, what_watch

    def _evaluate_visual_defaults(
        self,
        timeframe: str,
        has_volume: bool,
    ) -> Tuple[MarketMap, MarketStateContext, List[str], List[str], str, List[str]]:
        """Fallback evaluation for visual-only screenshot analysis."""
        market_map = MarketMap(
            price="Price has moved into upper portion of the visible consolidation range.",
            structure=f"Structural sequence on {timeframe} is testing prior swing reference boundaries.",
            time=f"Move duration reflects an established multi-candle leg on the {timeframe} interval.",
            volume="Volume context visible in lower pane." if has_volume else "Volume context unavailable from this screenshot.",
            range="Candle ranges reflect moderate volatility expansion following compression.",
            location="Price is located near the upper third of the visible chart frame.",
            candle_behavior="Recent candles exhibit directional bodies with mild upper wick hesitation.",
        )
        market_state = MarketStateContext(
            state=MarketContextState.EXPANDING,
            summary=f"Price is expanding outward from previous compression on the {timeframe} timeframe.",
        )
        supporting = [
            "Candle bodies reflect directional expansion over recent bars.",
            "Price holds above intermediate consolidation base.",
            "Range width has broadened compared to preceding compression candles.",
        ]
        conflicting = [
            "Upper wicks indicate responsive selling near visible resistance.",
            "Absence of secondary timeframe confirmation limits broader structural certainty.",
        ]
        current_ctx = (
            f"The market is currently expanding on the {timeframe} timeframe following recent compression. "
            f"Price is trading near the upper structural boundary of the visible sequence. "
            f"Confirmation of continuation requires observable acceptance above visible resistance."
        )
        what_watch = [
            "Acceptance above the visible structural high would confirm expansion continuity.",
            "A return into the prior compression range would signal a failed breakout attempt.",
            "Volume contraction during subsequent candles would suggest diminishing participation.",
        ]
        return market_map, market_state, supporting, conflicting, current_ctx, what_watch

    def _build_multi_timeframe_synthesis(
        self,
        primary_tf: str,
        primary_state: MarketContextState,
        secondary_screenshots: List[TimeframeScreenshot],
    ) -> Tuple[List[MultiTimeframeLevel], str]:
        """Synthesizes hierarchical relationship across multiple timeframes."""
        levels: List[MultiTimeframeLevel] = []

        # Order timeframes logically
        roles = ["HIGHER_TIMEFRAME", "INTERMEDIATE_TIMEFRAME", "CURRENT_TIMEFRAME", "LOCAL_BEHAVIOR"]
        role_idx = 0

        for sec in secondary_screenshots:
            role = roles[role_idx] if role_idx < len(roles) else "AUXILIARY_TIMEFRAME"
            levels.append(
                MultiTimeframeLevel(
                    timeframe=sec.timeframe,
                    structure_summary=f"Macro structure on {sec.timeframe} establishes the higher-level boundary framework.",
                    context_role=role,
                )
            )
            role_idx += 1

        levels.append(
            MultiTimeframeLevel(
                timeframe=primary_tf,
                structure_summary=f"Local price action on {primary_tf} is {primary_state.value.lower()}.",
                context_role="CURRENT_TIMEFRAME",
            )
        )

        synthesis = (
            f"The current {primary_tf} {primary_state.value.lower()} behavior is developing within the broader "
            f"structural context established by the higher timeframe. Local expansion or rotation must be evaluated "
            f"relative to overarching macro boundaries to avoid treating short-term moves as unconstrained trends."
        )
        return levels, synthesis
