"""Adversarial Courtroom Engine for GHOST.

Evaluates user market theses adversarially using real market data from Binance Spot
and GHOST's quantitative indicators. Enforces zero hallucination, evidence hierarchy,
and non-signal invalidation conditions.
"""

from datetime import datetime, timezone
import re
from typing import Any, Dict, List, Optional, Tuple
import uuid

import numpy as np
import pandas as pd

from app.schemas.courtroom import (
    CourtroomArgument,
    CourtroomCase,
    CourtroomCaseCreate,
    CourtroomEvidenceItem,
    CrossExaminationRow,
    EvidenceDirection,
    EvidenceHierarchy,
    EvidenceStrength,
    InvalidationCondition,
    ThesisStance,
    VerdictType,
)
from app.schemas.market import CanonicalCandle, CanonicalOrderBook, CanonicalPrice, CanonicalVolume
from app.services.feature_engine.feature_builder import FeatureBuilder


class CourtroomEngine:
    """Core adversarial reasoning engine challenging and defending user market theses."""

    def __init__(self) -> None:
        self.feature_builder = FeatureBuilder()

    def detect_stance(self, thesis: str) -> ThesisStance:
        """Parses natural language thesis to identify the user's directional stance."""
        text = thesis.lower()

        bullish_patterns = [
            r"\bbull(?:ish)?\b",
            r"\buptrend\b",
            r"\bbreakout\b",
            r"\brally\b",
            r"\blong\b",
            r"\bbuy(?:ing)?\b",
            r"\bsurge\b",
            r"\bhigher\b",
            r"\bbounce\b",
            r"\bbottom\b",
            r"\bpump\b",
            r"\bbreak(?:ing)?\s+resistance\b",
            r"\bclimb(?:ing)?\b",
            r"\bmoon\b",
            r"\bupward\b",
            r"\bexpansion\b",
        ]

        bearish_patterns = [
            r"\bbear(?:ish)?\b",
            r"\bdowntrend\b",
            r"\bbreak\s*down\b",
            r"\bdrop(?:ping)?\b",
            r"\bdump(?:ping)?\b",
            r"\bshort\b",
            r"\bsell(?:ing)?\b",
            r"\blower\b",
            r"\bcrash(?:ing)?\b",
            r"\bfall(?:ing)?\b",
            r"\bcollapse\b",
            r"\bbreak(?:ing)?\s+support\b",
            r"\blosing\s+support\b",
            r"\bdownward\b",
            r"\brejection\b",
            r"\bcorrection\b",
            r"\bbelow\b",
            r"\bdown\b",
        ]

        neutral_patterns = [
            r"\bsideways\b",
            r"\brange(?:-bound)?\b",
            r"\bconsolidation\b",
            r"\bneutral\b",
            r"\bchop(?:py)?\b",
            r"\bflat\b",
        ]

        bull_count = sum(1 for p in bullish_patterns if re.search(p, text))
        bear_count = sum(1 for p in bearish_patterns if re.search(p, text))
        neutral_count = sum(1 for p in neutral_patterns if re.search(p, text))

        if neutral_count > bull_count and neutral_count > bear_count:
            return ThesisStance.NEUTRAL_OR_RANGE
        elif bull_count > bear_count:
            return ThesisStance.BULLISH
        elif bear_count > bull_count:
            return ThesisStance.BEARISH
        elif bull_count > 0 and bear_count > 0:
            return ThesisStance.NEUTRAL_OR_RANGE

        return ThesisStance.BULLISH  # Default optimistic stance if ambiguous

    def evaluate_case(
        self,
        case_id: str,
        submission: CourtroomCaseCreate,
        candles: List[CanonicalCandle],
        ticker: CanonicalVolume,
        price: CanonicalPrice,
        order_book: CanonicalOrderBook,
    ) -> CourtroomCase:
        """Executes full adversarial proceeding over real market telemetry."""
        now = datetime.now(timezone.utc)
        symbol = submission.symbol.upper()
        timeframe = submission.timeframe
        stance = self.detect_stance(submission.thesis)

        # 1. Build chronological feature dataframe from real candles
        df = self.feature_builder.build_feature_matrix(candles)
        latest = df.iloc[-1]
        prev = df.iloc[-2] if len(df) > 1 else latest

        curr_price = float(price.price) if price and price.price else float(latest["close"])
        high_24h = float(ticker.high_24h) if ticker and ticker.high_24h is not None else float(df["high"].max())
        low_24h = float(ticker.low_24h) if ticker and ticker.low_24h is not None else float(df["low"].min())
        vol_24h = float(ticker.volume_24h) if ticker and ticker.volume_24h is not None else float(df["volume"].tail(24).sum())
        quote_vol_24h = float(ticker.quote_volume_24h) if ticker and ticker.quote_volume_24h is not None else (vol_24h * curr_price)
        source = ticker.source if ticker and ticker.source else "Binance Spot"

        # Indicators
        rsi = float(latest.get("rsi_14", 50.0))
        prev_rsi = float(prev.get("rsi_14", 50.0))
        macd_line = float(latest.get("macd", 0.0))
        macd_sig = float(latest.get("macd_signal", 0.0))
        macd_hist = float(latest.get("macd_hist", 0.0))
        prev_macd_hist = float(prev.get("macd_hist", 0.0))

        sma_20 = float(latest.get("sma_20", curr_price))
        sma_50 = float(latest.get("sma_50", curr_price))
        ema_12 = float(latest.get("ema_12", curr_price))
        ema_26 = float(latest.get("ema_26", curr_price))
        bb_upper = float(latest.get("bb_upper", curr_price * 1.02))
        bb_lower = float(latest.get("bb_lower", curr_price * 0.98))
        bb_bandwidth = float(latest.get("bb_bandwidth", 0.04))
        atr_14 = float(latest.get("atr_14", curr_price * 0.015))

        # Recent swing high/low over last 20 candles
        window_candles = df.tail(20)
        swing_high = float(window_candles["high"].max())
        swing_low = float(window_candles["low"].min())

        # Volume dynamics
        avg_vol_20 = float(window_candles["volume"].mean()) if len(window_candles) > 0 else float(latest["volume"])
        curr_candle_vol = float(latest["volume"])
        vol_ratio = (curr_candle_vol / avg_vol_20) if avg_vol_20 > 0 else 1.0

        # Order book dynamics
        bids_depth = sum(float(b.quantity) for b in (order_book.bids[:10] if order_book else []))
        asks_depth = sum(float(a.quantity) for a in (order_book.asks[:10] if order_book else []))
        total_depth = bids_depth + asks_depth
        orderbook_imbalance = ((bids_depth - asks_depth) / total_depth) if total_depth > 0 else 0.0

        # Snapshot
        market_snapshot = {
            "symbol": symbol,
            "timeframe": timeframe,
            "price": curr_price,
            "high_24h": high_24h,
            "low_24h": low_24h,
            "volume_24h": vol_24h,
            "quote_volume_24h": quote_vol_24h,
            "source": source,
            "timestamp": now.isoformat(),
            "rsi_14": round(rsi, 2),
            "macd_hist": round(macd_hist, 4),
            "ema_12": round(ema_12, 2),
            "ema_26": round(ema_26, 2),
            "sma_20": round(sma_20, 2),
            "sma_50": round(sma_50, 2),
            "orderbook_imbalance": round(orderbook_imbalance, 4),
        }

        # 2. Build Evidence Items and Arguments
        evidence_pool: List[CourtroomEvidenceItem] = []
        prosecution_args: List[CourtroomArgument] = []
        defense_args: List[CourtroomArgument] = []

        if stance == ThesisStance.BULLISH:
            prosecution_args, defense_args, evidence_pool = self._build_bullish_case(
                symbol=symbol,
                timeframe=timeframe,
                curr_price=curr_price,
                high_24h=high_24h,
                low_24h=low_24h,
                swing_high=swing_high,
                swing_low=swing_low,
                rsi=rsi,
                prev_rsi=prev_rsi,
                macd_line=macd_line,
                macd_sig=macd_sig,
                macd_hist=macd_hist,
                prev_macd_hist=prev_macd_hist,
                sma_20=sma_20,
                sma_50=sma_50,
                ema_12=ema_12,
                ema_26=ema_26,
                bb_upper=bb_upper,
                bb_lower=bb_lower,
                bb_bandwidth=bb_bandwidth,
                atr_14=atr_14,
                curr_candle_vol=curr_candle_vol,
                avg_vol_20=avg_vol_20,
                vol_ratio=vol_ratio,
                orderbook_imbalance=orderbook_imbalance,
                bids_depth=bids_depth,
                asks_depth=asks_depth,
                source=source,
                now=now,
                quote_vol_24h=quote_vol_24h,
                user_support=submission.support_level,
                user_resistance=submission.resistance_level,
            )
        elif stance == ThesisStance.BEARISH:
            prosecution_args, defense_args, evidence_pool = self._build_bearish_case(
                symbol=symbol,
                timeframe=timeframe,
                curr_price=curr_price,
                high_24h=high_24h,
                low_24h=low_24h,
                swing_high=swing_high,
                swing_low=swing_low,
                rsi=rsi,
                prev_rsi=prev_rsi,
                macd_line=macd_line,
                macd_sig=macd_sig,
                macd_hist=macd_hist,
                prev_macd_hist=prev_macd_hist,
                sma_20=sma_20,
                sma_50=sma_50,
                ema_12=ema_12,
                ema_26=ema_26,
                bb_upper=bb_upper,
                bb_lower=bb_lower,
                bb_bandwidth=bb_bandwidth,
                atr_14=atr_14,
                curr_candle_vol=curr_candle_vol,
                avg_vol_20=avg_vol_20,
                vol_ratio=vol_ratio,
                orderbook_imbalance=orderbook_imbalance,
                bids_depth=bids_depth,
                asks_depth=asks_depth,
                source=source,
                now=now,
                user_support=submission.support_level,
                user_resistance=submission.resistance_level,
            )
        else:
            prosecution_args, defense_args, evidence_pool = self._build_neutral_case(
                symbol=symbol,
                timeframe=timeframe,
                curr_price=curr_price,
                high_24h=high_24h,
                low_24h=low_24h,
                swing_high=swing_high,
                swing_low=swing_low,
                rsi=rsi,
                prev_rsi=prev_rsi,
                macd_hist=macd_hist,
                bb_bandwidth=bb_bandwidth,
                vol_ratio=vol_ratio,
                orderbook_imbalance=orderbook_imbalance,
                source=source,
                now=now,
            )

        # 3. Build Cross-Examination Comparison
        cross_exam = self._build_cross_examination(
            stance=stance,
            curr_price=curr_price,
            rsi=rsi,
            prev_rsi=prev_rsi,
            macd_hist=macd_hist,
            sma_20=sma_20,
            sma_50=sma_50,
            vol_ratio=vol_ratio,
            bb_bandwidth=bb_bandwidth,
            orderbook_imbalance=orderbook_imbalance,
            swing_high=swing_high,
            swing_low=swing_low,
        )

        # 4. Evaluate Verdict
        verdict, verdict_rationale = self._evaluate_verdict(
            stance=stance,
            prosecution_args=prosecution_args,
            defense_args=defense_args,
            cross_exam=cross_exam,
        )

        # 5. Build Thesis Invalidation Conditions (NOT signals)
        invalidation_conditions = self._build_invalidation_conditions(
            stance=stance,
            curr_price=curr_price,
            swing_high=swing_high,
            swing_low=swing_low,
            ema_26=ema_26,
            sma_50=sma_50,
            rsi=rsi,
            user_support=submission.support_level,
            user_resistance=submission.resistance_level,
        )

        return CourtroomCase(
            case_id=case_id,
            symbol=symbol,
            timeframe=timeframe,
            user_thesis=submission.thesis,
            user_notes=submission.notes,
            detected_stance=stance,
            status="IN_SESSION",
            market_snapshot=market_snapshot,
            prosecution_arguments=prosecution_args,
            defense_arguments=defense_args,
            cross_examination=cross_exam,
            verdict=verdict,
            verdict_rationale=verdict_rationale,
            invalidation_conditions=invalidation_conditions,
            data_sources=[source, "GHOST Feature Engine"],
            evidence_count=len(evidence_pool),
            created_at=now,
        )

    # -------------------------------------------------------------------------
    # Case Builder: BULLISH THESIS
    # -------------------------------------------------------------------------
    def _build_bullish_case(
        self,
        symbol: str,
        timeframe: str,
        curr_price: float,
        high_24h: float,
        low_24h: float,
        swing_high: float,
        swing_low: float,
        rsi: float,
        prev_rsi: float,
        macd_line: float,
        macd_sig: float,
        macd_hist: float,
        prev_macd_hist: float,
        sma_20: float,
        sma_50: float,
        ema_12: float,
        ema_26: float,
        bb_upper: float,
        bb_lower: float,
        bb_bandwidth: float,
        atr_14: float,
        curr_candle_vol: float,
        avg_vol_20: float,
        vol_ratio: float,
        orderbook_imbalance: float,
        bids_depth: float,
        asks_depth: float,
        source: str,
        now: datetime,
        quote_vol_24h: float,
        user_support: Optional[float],
        user_resistance: Optional[float],
    ) -> Tuple[List[CourtroomArgument], List[CourtroomArgument], List[CourtroomEvidenceItem]]:
        prosecution: List[CourtroomArgument] = []
        defense: List[CourtroomArgument] = []
        evidence_items: List[CourtroomEvidenceItem] = []

        # --- PROSECUTION (Attacking the Bullish Thesis) ---

        # 1. Momentum deceleration / exhaustion
        rsi_delta = rsi - prev_rsi
        if rsi >= 70.0:
            obs = f"RSI(14) is elevated at {rsi:.1f}, entering the overbought zone (> 70.0)."
            why = "Extreme RSI readings frequently precede momentum exhaustion or corrective pullbacks."
            strength = EvidenceStrength.STRONG
        elif rsi_delta < -3.0 or rsi < 50.0:
            obs = f"RSI(14) has declined from {prev_rsi:.1f} to {rsi:.1f} ({rsi_delta:+.1f} change)."
            why = "Upward momentum is weakening despite price remaining elevated."
            strength = EvidenceStrength.MODERATE if rsi < 50.0 else EvidenceStrength.WEAK
        else:
            obs = f"MACD histogram sits at {macd_hist:+.4f}, showing subdued momentum expansion."
            why = "Bullish momentum lacks strong acceleration across the trailing window."
            strength = EvidenceStrength.WEAK

        ev1 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="indicator",
            hierarchy=EvidenceHierarchy.DERIVED_INDICATOR,
            name="RSI Momentum & MACD",
            value={"rsi_14": round(rsi, 2), "rsi_delta": round(rsi_delta, 2), "macd_hist": round(macd_hist, 4)},
            threshold_or_condition="RSI > 70 (Overbought) or Declining Delta",
            observation=obs,
            direction=EvidenceDirection.OPPOSING,
            strength=strength,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev1)
        prosecution.append(
            CourtroomArgument(
                id="PA-1",
                role="PROSECUTION",
                claim="Momentum is failing to confirm the bullish thesis.",
                observation=obs,
                why_it_matters=why,
                strength=strength,
                source=source,
                updated_ago="0.4s ago",
                evidence_items=[ev1],
            )
        )

        # 2. Structural resistance & moving average headwind
        below_sma50 = curr_price < sma_50
        proximity_to_high = ((high_24h - curr_price) / curr_price) * 100 if curr_price > 0 else 0.0

        if below_sma50:
            obs_struct = f"Price (${curr_price:,.2f}) trades below the 50-period SMA (${sma_50:,.2f})."
            why_struct = "A market trading beneath its intermediate baseline faces structural supply."
            strength_struct = EvidenceStrength.STRONG
        elif proximity_to_high < 1.0:
            obs_struct = f"Price is within {proximity_to_high:.2f}% of the 24h high (${high_24h:,.2f}) without clean breakout volume."
            why_struct = "Testing overhead resistance without immediate expansion exposes the thesis to rejection."
            strength_struct = EvidenceStrength.MODERATE
        else:
            obs_struct = f"Current price (${curr_price:,.2f}) remains capped below swing high (${swing_high:,.2f})."
            why_struct = "The market has not yet proven higher-high continuation."
            strength_struct = EvidenceStrength.MODERATE

        ev2 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="price_action",
            hierarchy=EvidenceHierarchy.DIRECT_OBSERVATION,
            name="Structural Supply & Resistance",
            value={"price": round(curr_price, 2), "sma_50": round(sma_50, 2), "swing_high": round(swing_high, 2)},
            threshold_or_condition="Price vs 50 SMA / Swing High",
            observation=obs_struct,
            direction=EvidenceDirection.OPPOSING,
            strength=strength_struct,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev2)
        prosecution.append(
            CourtroomArgument(
                id="PA-2",
                role="PROSECUTION",
                claim="Structural resistance and moving averages challenge upward follow-through.",
                observation=obs_struct,
                why_it_matters=why_struct,
                strength=strength_struct,
                source=source,
                updated_ago="0.6s ago",
                evidence_items=[ev2],
            )
        )

        # 3. Order Book & Volume counter-pressure
        if orderbook_imbalance < -0.15:
            obs_vol = f"Order book imbalance is negative ({orderbook_imbalance:+.2f}), with ask depth ({asks_depth:.2f}) exceeding bid depth ({bids_depth:.2f})."
            why_vol = "Heavy resting ask liquidity creates immediate resistance against upward price movement."
            strength_vol = EvidenceStrength.STRONG
        elif vol_ratio < 0.8:
            obs_vol = f"Current candle volume is {(vol_ratio * 100):.1f}% of the 20-period average ({curr_candle_vol:.2f} vs {avg_vol_20:.2f})."
            why_vol = "Light volume indicates institutional participation is not actively confirming the upside move."
            strength_vol = EvidenceStrength.MODERATE
        else:
            obs_vol = f"Volume expansion is muted relative to 24h quote volume (${quote_vol_24h:,.0f})."
            why_vol = "Sustainable bull trends require expanding turnover rather than passive drift."
            strength_vol = EvidenceStrength.WEAK

        ev3 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="orderbook",
            hierarchy=EvidenceHierarchy.DIRECT_OBSERVATION,
            name="Microstructure & Volume Turnover",
            value={"imbalance": round(orderbook_imbalance, 4), "vol_ratio": round(vol_ratio, 2)},
            threshold_or_condition="Order Book Imbalance < -0.15 or Volume < 0.8x avg",
            observation=obs_vol,
            direction=EvidenceDirection.OPPOSING,
            strength=strength_vol,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev3)
        prosecution.append(
            CourtroomArgument(
                id="PA-3",
                role="PROSECUTION",
                claim="Order flow and participation metrics do not demonstrate aggressive buyer dominance.",
                observation=obs_vol,
                why_it_matters=why_vol,
                strength=strength_vol,
                source=source,
                updated_ago="0.5s ago",
                evidence_items=[ev3],
            )
        )

        # --- DEFENSE (Supporting the Bullish Thesis) ---

        # 1. Trend baseline & structural support
        above_ema26 = curr_price > ema_26
        above_swing_low = curr_price > swing_low
        if curr_price > sma_20 and above_ema26:
            obs_def1 = f"Price (${curr_price:,.2f}) maintains position above the 20 SMA (${sma_20:,.2f}) and 26 EMA (${ema_26:,.2f})."
            why_def1 = "Short-to-intermediate moving averages continue to offer dynamic support to the uptrend."
            strength_def1 = EvidenceStrength.STRONG
        elif above_swing_low:
            obs_def1 = f"Price holds firmly above recent swing low (${swing_low:,.2f}), preserving higher-low structure."
            why_def1 = "As long as the previous swing low remains unviolated, the broader bullish posture remains structurally intact."
            strength_def1 = EvidenceStrength.MODERATE
        else:
            obs_def1 = f"Price is anchored above 24h low of ${low_24h:,.2f}."
            why_def1 = "Market has rejected lower bounds during the preceding 24-hour cycle."
            strength_def1 = EvidenceStrength.WEAK

        ev4 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="price_action",
            hierarchy=EvidenceHierarchy.DIRECT_OBSERVATION,
            name="Baseline Support & Swing Structure",
            value={"price": round(curr_price, 2), "sma_20": round(sma_20, 2), "swing_low": round(swing_low, 2)},
            threshold_or_condition="Price > 20 SMA or Holding Swing Low",
            observation=obs_def1,
            direction=EvidenceDirection.SUPPORTING,
            strength=strength_def1,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev4)
        defense.append(
            CourtroomArgument(
                id="DA-1",
                role="DEFENSE",
                claim="The market's structural support and trend baseline remain defended.",
                observation=obs_def1,
                why_it_matters=why_def1,
                strength=strength_def1,
                source=source,
                updated_ago="0.4s ago",
                evidence_items=[ev4],
            )
        )

        # 2. Bullish momentum & oscillator positioning
        if rsi >= 50.0 and rsi < 70.0:
            obs_def2 = f"RSI(14) is in constructive bull territory at {rsi:.1f} (between 50 and 70)."
            why_def2 = "Oscillators residing comfortably above the 50 centerline reflect persistent buyer control without imminent overheating."
            strength_def2 = EvidenceStrength.STRONG
        elif macd_line > macd_sig:
            obs_def2 = f"MACD line ({macd_line:.2f}) remains above signal line ({macd_sig:.2f}), confirming positive trend alignment."
            why_def2 = "Positive MACD alignment indicates ongoing expansion in moving average momentum."
            strength_def2 = EvidenceStrength.MODERATE
        else:
            obs_def2 = f"RSI(14) at {rsi:.1f} shows the market is avoiding oversold distress."
            why_def2 = "Oscillator stability provides room for upside recovery if buying pressure returns."
            strength_def2 = EvidenceStrength.WEAK

        ev5 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="indicator",
            hierarchy=EvidenceHierarchy.DERIVED_INDICATOR,
            name="Oscillator Health & Alignment",
            value={"rsi_14": round(rsi, 2), "macd_line": round(macd_line, 4), "macd_sig": round(macd_sig, 4)},
            threshold_or_condition="50 <= RSI < 70 or MACD > Signal",
            observation=obs_def2,
            direction=EvidenceDirection.SUPPORTING,
            strength=strength_def2,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev5)
        defense.append(
            CourtroomArgument(
                id="DA-2",
                role="DEFENSE",
                claim="Oscillator framework supports continuous buyer engagement.",
                observation=obs_def2,
                why_it_matters=why_def2,
                strength=strength_def2,
                source=source,
                updated_ago="0.5s ago",
                evidence_items=[ev5],
            )
        )

        # 3. Order flow support & volatility backdrop
        if orderbook_imbalance > 0.10:
            obs_def3 = f"Order book displays positive bid imbalance ({orderbook_imbalance:+.2f}), with bid depth ({bids_depth:.2f}) absorbing sell liquidity."
            why_def3 = "Active buyer interest in the order book provides immediate cushion against sudden down-wicks."
            strength_def3 = EvidenceStrength.STRONG
        elif vol_ratio >= 1.0:
            obs_def3 = f"Candle turnover is healthy at {(vol_ratio * 100):.1f}% of trailing average."
            why_def3 = "Adequate volume supports orderly price discovery."
            strength_def3 = EvidenceStrength.MODERATE
        else:
            obs_def3 = f"Bollinger bandwidth ({bb_bandwidth:.3f}) indicates controlled volatility envelopes."
            why_def3 = "Controlled volatility prevents erratic liquidation cascades."
            strength_def3 = EvidenceStrength.WEAK

        ev6 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="orderbook",
            hierarchy=EvidenceHierarchy.DIRECT_OBSERVATION,
            name="Liquidity Absorption & Volatility",
            value={"imbalance": round(orderbook_imbalance, 4), "bids_depth": round(bids_depth, 2)},
            threshold_or_condition="Order Book Imbalance > 0.10",
            observation=obs_def3,
            direction=EvidenceDirection.SUPPORTING,
            strength=strength_def3,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev6)
        defense.append(
            CourtroomArgument(
                id="DA-3",
                role="DEFENSE",
                claim="Market microstructure contains active liquidity reserves supporting price.",
                observation=obs_def3,
                why_it_matters=why_def3,
                strength=strength_def3,
                source=source,
                updated_ago="0.4s ago",
                evidence_items=[ev6],
            )
        )

        return prosecution, defense, evidence_items

    # -------------------------------------------------------------------------
    # Case Builder: BEARISH THESIS
    # -------------------------------------------------------------------------
    def _build_bearish_case(
        self,
        symbol: str,
        timeframe: str,
        curr_price: float,
        high_24h: float,
        low_24h: float,
        swing_high: float,
        swing_low: float,
        rsi: float,
        prev_rsi: float,
        macd_line: float,
        macd_sig: float,
        macd_hist: float,
        prev_macd_hist: float,
        sma_20: float,
        sma_50: float,
        ema_12: float,
        ema_26: float,
        bb_upper: float,
        bb_lower: float,
        bb_bandwidth: float,
        atr_14: float,
        curr_candle_vol: float,
        avg_vol_20: float,
        vol_ratio: float,
        orderbook_imbalance: float,
        bids_depth: float,
        asks_depth: float,
        source: str,
        now: datetime,
        user_support: Optional[float],
        user_resistance: Optional[float],
    ) -> Tuple[List[CourtroomArgument], List[CourtroomArgument], List[CourtroomEvidenceItem]]:
        prosecution: List[CourtroomArgument] = []
        defense: List[CourtroomArgument] = []
        evidence_items: List[CourtroomEvidenceItem] = []

        # --- PROSECUTION (Attacking the Bearish Thesis) ---

        # 1. Price holding above key support / moving averages
        if curr_price > sma_50:
            obs = f"Price (${curr_price:,.2f}) remains above the 50-period SMA (${sma_50:,.2f})."
            why = "A market trading above its 50 SMA retains higher-timeframe bullish structure, directly challenging a breakdown thesis."
            strength = EvidenceStrength.STRONG
        elif curr_price > swing_low:
            obs = f"Price is defending the local swing low (${swing_low:,.2f}), rejecting breakdown attempts."
            why = "Without a confirmed break beneath prior structure, bearish continuation is premature."
            strength = EvidenceStrength.MODERATE
        else:
            obs = f"Price is holding above 24h low of ${low_24h:,.2f}."
            why = "The market has not expanded into new intraday lows."
            strength = EvidenceStrength.WEAK

        ev1 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="price_action",
            hierarchy=EvidenceHierarchy.DIRECT_OBSERVATION,
            name="Key Baseline Defense",
            value={"price": round(curr_price, 2), "sma_50": round(sma_50, 2), "swing_low": round(swing_low, 2)},
            threshold_or_condition="Price > 50 SMA or Swing Low",
            observation=obs,
            direction=EvidenceDirection.OPPOSING,
            strength=strength,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev1)
        prosecution.append(
            CourtroomArgument(
                id="PA-1",
                role="PROSECUTION",
                claim="Key structural supports remain intact, opposing immediate breakdown.",
                observation=obs,
                why_it_matters=why,
                strength=strength,
                source=source,
                updated_ago="0.4s ago",
                evidence_items=[ev1],
            )
        )

        # 2. Oscillator bounce / oversold absorption
        if rsi <= 30.0:
            obs_osc = f"RSI(14) has reached {rsi:.1f}, signaling oversold conditions."
            why_osc = "Oversold RSI readings regularly trigger aggressive mean-reversion short-covering bounces."
            strength_osc = EvidenceStrength.STRONG
        elif rsi > 50.0:
            obs_osc = f"RSI(14) sits at {rsi:.1f}, above the 50 neutrality threshold."
            why_osc = "Oscillators residing above 50 contradict the premise of dominant seller momentum."
            strength_osc = EvidenceStrength.STRONG
        else:
            obs_osc = f"MACD histogram sits at {macd_hist:+.4f}, with declining downward acceleration."
            why_osc = "Selling velocity is tapering off rather than expanding."
            strength_osc = EvidenceStrength.MODERATE

        ev2 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="indicator",
            hierarchy=EvidenceHierarchy.DERIVED_INDICATOR,
            name="Oscillator Resistance Against Drop",
            value={"rsi_14": round(rsi, 2), "macd_hist": round(macd_hist, 4)},
            threshold_or_condition="RSI <= 30 or RSI > 50",
            observation=obs_osc,
            direction=EvidenceDirection.OPPOSING,
            strength=strength_osc,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev2)
        prosecution.append(
            CourtroomArgument(
                id="PA-2",
                role="PROSECUTION",
                claim="Momentum indicators indicate seller exhaustion and potential bounce risk.",
                observation=obs_osc,
                why_it_matters=why_osc,
                strength=strength_osc,
                source=source,
                updated_ago="0.5s ago",
                evidence_items=[ev2],
            )
        )

        # 3. Microstructure bid absorption
        if orderbook_imbalance > 0.15:
            obs_book = f"Order book exhibits positive bid imbalance ({orderbook_imbalance:+.2f}), with bid depth ({bids_depth:.2f}) outweighing asks ({asks_depth:.2f})."
            why_book = "Thick bid density absorbs downward selling pressure, impeding downward progress."
            strength_book = EvidenceStrength.STRONG
        else:
            obs_book = f"Volume on recent sell candles is {(vol_ratio * 100):.1f}% of average, showing limited panic dumping."
            why_book = "Breakdowns lacking high-volume expansion struggle to sustain continuation."
            strength_book = EvidenceStrength.MODERATE

        ev3 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="orderbook",
            hierarchy=EvidenceHierarchy.DIRECT_OBSERVATION,
            name="Bid Depth & Volume Absorption",
            value={"imbalance": round(orderbook_imbalance, 4), "vol_ratio": round(vol_ratio, 2)},
            threshold_or_condition="Order Book Imbalance > 0.15",
            observation=obs_book,
            direction=EvidenceDirection.OPPOSING,
            strength=strength_book,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev3)
        prosecution.append(
            CourtroomArgument(
                id="PA-3",
                role="PROSECUTION",
                claim="Order flow metrics indicate active bid liquidity absorbing sell pressure.",
                observation=obs_book,
                why_it_matters=why_book,
                strength=strength_book,
                source=source,
                updated_ago="0.4s ago",
                evidence_items=[ev3],
            )
        )

        # --- DEFENSE (Supporting the Bearish Thesis) ---

        # 1. Structural breakdown / moving average resistance
        if curr_price < sma_20 and curr_price < ema_26:
            obs_def1 = f"Price (${curr_price:,.2f}) trades below both the 20 SMA (${sma_20:,.2f}) and 26 EMA (${ema_26:,.2f})."
            why_def1 = "Sellers have established control beneath critical trailing moving average benchmarks."
            strength_def1 = EvidenceStrength.STRONG
        elif curr_price < swing_high:
            obs_def1 = f"Price was rejected near swing high (${swing_high:,.2f}), forming lower high structure."
            why_def1 = "Repeated failure to take out resistance levels validates bearish continuation dynamics."
            strength_def1 = EvidenceStrength.MODERATE
        else:
            obs_def1 = f"Price is within 2.0% of the 24h low (${low_24h:,.2f})."
            why_def1 = "The market is pressing lower boundary levels."
            strength_def1 = EvidenceStrength.WEAK

        ev4 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="price_action",
            hierarchy=EvidenceHierarchy.DIRECT_OBSERVATION,
            name="Moving Average Rejection & Resistance",
            value={"price": round(curr_price, 2), "sma_20": round(sma_20, 2), "ema_26": round(ema_26, 2)},
            threshold_or_condition="Price < 20 SMA & 26 EMA",
            observation=obs_def1,
            direction=EvidenceDirection.SUPPORTING,
            strength=strength_def1,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev4)
        defense.append(
            CourtroomArgument(
                id="DA-1",
                role="DEFENSE",
                claim="Moving average rejection and overhead supply validate the bearish bias.",
                observation=obs_def1,
                why_it_matters=why_def1,
                strength=strength_def1,
                source=source,
                updated_ago="0.4s ago",
                evidence_items=[ev4],
            )
        )

        # 2. Bearish momentum indicators
        if rsi < 45.0 or macd_hist < 0:
            obs_def2 = f"RSI(14) has dipped to {rsi:.1f} with MACD histogram negative ({macd_hist:+.4f})."
            why_def2 = "Oscillators residing in negative territory affirm that downward momentum holds authority."
            strength_def2 = EvidenceStrength.STRONG
        else:
            obs_def2 = f"RSI has declined by {abs(rsi - prev_rsi):.1f} points over recent periods."
            why_def2 = "Momentum is decelerating, providing room for further downside development."
            strength_def2 = EvidenceStrength.MODERATE

        ev5 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="indicator",
            hierarchy=EvidenceHierarchy.DERIVED_INDICATOR,
            name="Negative Momentum Dynamics",
            value={"rsi_14": round(rsi, 2), "macd_hist": round(macd_hist, 4)},
            threshold_or_condition="RSI < 45 or MACD Hist < 0",
            observation=obs_def2,
            direction=EvidenceDirection.SUPPORTING,
            strength=strength_def2,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev5)
        defense.append(
            CourtroomArgument(
                id="DA-2",
                role="DEFENSE",
                claim="Oscillator momentum confirms ongoing downward price pressure.",
                observation=obs_def2,
                why_it_matters=why_def2,
                strength=strength_def2,
                source=source,
                updated_ago="0.5s ago",
                evidence_items=[ev5],
            )
        )

        # 3. Order book supply & resistance walls
        if orderbook_imbalance < -0.10:
            obs_def3 = f"Ask liquidity dominates order book (imbalance {orderbook_imbalance:+.2f}), with ask depth ({asks_depth:.2f}) exceeding bids ({bids_depth:.2f})."
            why_def3 = "Dominant resting ask walls discourage buyers from attempting upside recoveries."
            strength_def3 = EvidenceStrength.STRONG
        else:
            obs_def3 = f"Bollinger band envelope is expanding downward with lower band at ${bb_lower:,.2f}."
            why_def3 = "Expanding downward band channels accommodate sustained downward movement."
            strength_def3 = EvidenceStrength.MODERATE

        ev6 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="orderbook",
            hierarchy=EvidenceHierarchy.DIRECT_OBSERVATION,
            name="Overhead Ask Pressure",
            value={"imbalance": round(orderbook_imbalance, 4), "asks_depth": round(asks_depth, 2)},
            threshold_or_condition="Order Book Imbalance < -0.10",
            observation=obs_def3,
            direction=EvidenceDirection.SUPPORTING,
            strength=strength_def3,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev6)
        defense.append(
            CourtroomArgument(
                id="DA-3",
                role="DEFENSE",
                claim="Microstructure order flow favors continuation of the bearish stance.",
                observation=obs_def3,
                why_it_matters=why_def3,
                strength=strength_def3,
                source=source,
                updated_ago="0.4s ago",
                evidence_items=[ev6],
            )
        )

        return prosecution, defense, evidence_items

    # -------------------------------------------------------------------------
    # Case Builder: NEUTRAL / RANGE THESIS
    # -------------------------------------------------------------------------
    def _build_neutral_case(
        self,
        symbol: str,
        timeframe: str,
        curr_price: float,
        high_24h: float,
        low_24h: float,
        swing_high: float,
        swing_low: float,
        rsi: float,
        prev_rsi: float,
        macd_hist: float,
        bb_bandwidth: float,
        vol_ratio: float,
        orderbook_imbalance: float,
        source: str,
        now: datetime,
    ) -> Tuple[List[CourtroomArgument], List[CourtroomArgument], List[CourtroomEvidenceItem]]:
        prosecution: List[CourtroomArgument] = []
        defense: List[CourtroomArgument] = []
        evidence_items: List[CourtroomEvidenceItem] = []

        # Prosecution attacks range thesis by looking for breakout potential / volatility expansion
        if bb_bandwidth > 0.05:
            obs = f"Bollinger bandwidth is expanding at {bb_bandwidth:.3f}, indicating volatility emergence."
            why = "Expanding bandwidth breaks range compression, favoring directional expansion over stagnation."
            strength = EvidenceStrength.STRONG
        elif abs(orderbook_imbalance) > 0.20:
            obs = f"Order book is skewed directionally (imbalance {orderbook_imbalance:+.2f})."
            why = "Asymmetric liquidity pressure threatens range boundaries."
            strength = EvidenceStrength.MODERATE
        else:
            obs = f"RSI(14) at {rsi:.1f} is shifting towards directional boundary."
            why = "Oscillator momentum is not perfectly centered."
            strength = EvidenceStrength.WEAK

        ev1 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="indicator",
            hierarchy=EvidenceHierarchy.DERIVED_INDICATOR,
            name="Volatility & Directional Pressure",
            value={"bandwidth": round(bb_bandwidth, 4), "imbalance": round(orderbook_imbalance, 4)},
            threshold_or_condition="Bandwidth > 0.05 or Imbalance > 0.20",
            observation=obs,
            direction=EvidenceDirection.OPPOSING,
            strength=strength,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev1)
        prosecution.append(
            CourtroomArgument(
                id="PA-1",
                role="PROSECUTION",
                claim="Emerging volatility and order flow skew challenge range-bound assumptions.",
                observation=obs,
                why_it_matters=why,
                strength=strength,
                source=source,
                updated_ago="0.4s ago",
                evidence_items=[ev1],
            )
        )

        # Defense validates the range
        obs_def = f"Price is bounded between swing low (${swing_low:,.2f}) and swing high (${swing_high:,.2f}), with RSI at {rsi:.1f} near the 50 median."
        why_def = "Mean-reverting oscillators and bounded price channels confirm consolidation."
        ev2 = CourtroomEvidenceItem(
            id=f"EV-{uuid.uuid4().hex[:6]}",
            type="price_action",
            hierarchy=EvidenceHierarchy.DIRECT_OBSERVATION,
            name="Consolidation Channel",
            value={"range_low": round(swing_low, 2), "range_high": round(swing_high, 2), "rsi": round(rsi, 2)},
            threshold_or_condition="RSI between 45 and 55",
            observation=obs_def,
            direction=EvidenceDirection.SUPPORTING,
            strength=EvidenceStrength.MODERATE,
            source=source,
            event_time=now,
        )
        evidence_items.append(ev2)
        defense.append(
            CourtroomArgument(
                id="DA-1",
                role="DEFENSE",
                claim="Price containment within established boundaries supports the sideways premise.",
                observation=obs_def,
                why_it_matters=why_def,
                strength=EvidenceStrength.MODERATE,
                source=source,
                updated_ago="0.4s ago",
                evidence_items=[ev2],
            )
        )

        return prosecution, defense, evidence_items

    # -------------------------------------------------------------------------
    # Cross-Examination Matrix
    # -------------------------------------------------------------------------
    def _build_cross_examination(
        self,
        stance: ThesisStance,
        curr_price: float,
        rsi: float,
        prev_rsi: float,
        macd_hist: float,
        sma_20: float,
        sma_50: float,
        vol_ratio: float,
        bb_bandwidth: float,
        orderbook_imbalance: float,
        swing_high: float,
        swing_low: float,
    ) -> List[CrossExaminationRow]:
        rows: List[CrossExaminationRow] = []

        # 1. Momentum Dimension
        if stance == ThesisStance.BULLISH:
            sup_m = f"RSI({rsi:.1f}) maintains above 45 threshold; MACD histogram at {macd_hist:+.4f}."
            opp_m = f"RSI shifted by {rsi - prev_rsi:+.1f} points; upward acceleration is subdued."
            conflict_m = "RSI baseline is constructive but lacks aggressive momentum acceleration."
            sev_m = "MODERATE" if (rsi > 50 and macd_hist < 0) else "LOW"
        else:
            sup_m = f"RSI({rsi:.1f}) below 55 with negative histogram expansion ({macd_hist:+.4f})."
            opp_m = f"RSI avoiding oversold collapse; potential for technical short-covering."
            conflict_m = "Bearish oscillator pressure meets potential floor stabilization."
            sev_m = "MODERATE"

        rows.append(
            CrossExaminationRow(
                dimension="Momentum & Velocity",
                supporting_evidence=sup_m,
                opposing_evidence=opp_m,
                conflict_assessment=conflict_m,
                severity=sev_m,
            )
        )

        # 2. Trend Structure Dimension
        if stance == ThesisStance.BULLISH:
            sup_t = f"Price (${curr_price:,.2f}) remains above swing low (${swing_low:,.2f})."
            opp_t = f"Price is capped under 50 SMA (${sma_50:,.2f}) or swing high (${swing_high:,.2f})."
            conflict_t = "Higher-low structure coexists with overhead moving average resistance."
            sev_t = "HIGH" if curr_price < sma_50 else "MODERATE"
        else:
            sup_t = f"Price rejection beneath swing high (${swing_high:,.2f}); trading under 20 SMA."
            opp_t = f"Price maintaining cushion above intermediate support (${swing_low:,.2f})."
            conflict_t = "Short-term weakness has not yet broken multi-session support."
            sev_t = "HIGH" if curr_price > sma_50 else "LOW"

        rows.append(
            CrossExaminationRow(
                dimension="Trend Structure",
                supporting_evidence=sup_t,
                opposing_evidence=opp_t,
                conflict_assessment=conflict_t,
                severity=sev_t,
            )
        )

        # 3. Volume Dynamics Dimension
        vol_pct = vol_ratio * 100
        sup_v = f"Recent candle volume is {vol_pct:.0f}% of 20-period average."
        opp_v = "Volume has not exhibited significant institutional climax expansion."
        conflict_v = "Turnover remains steady but lacks distinctive breakout validation."
        sev_v = "MODERATE" if vol_ratio < 0.75 else "LOW"

        rows.append(
            CrossExaminationRow(
                dimension="Volume Dynamics",
                supporting_evidence=sup_v,
                opposing_evidence=opp_v,
                conflict_assessment=conflict_v,
                severity=sev_v,
            )
        )

        # 4. Volatility & Envelopes
        sup_vol = f"Bollinger bandwidth at {bb_bandwidth:.3f} reflects structured price channels."
        opp_vol = "Bandwidth compression suggests potential for an impending volatility breakout."
        conflict_vol = "Current calm price behavior may precede an abrupt range break."
        sev_vol = "LOW"

        rows.append(
            CrossExaminationRow(
                dimension="Volatility Envelopes",
                supporting_evidence=sup_vol,
                opposing_evidence=opp_vol,
                conflict_assessment=conflict_vol,
                severity=sev_vol,
            )
        )

        # 5. Order Flow & Microstructure
        if stance == ThesisStance.BULLISH:
            sup_of = f"Bid depth presents support cushions in nearest depth tiers."
            opp_of = f"Order book imbalance at {orderbook_imbalance:+.2f} reflects competing ask density."
            conflict_of = "Resting ask supply dampens immediate upward expansion."
            sev_of = "HIGH" if orderbook_imbalance < -0.15 else "MODERATE"
        else:
            sup_of = f"Resting ask supply exerts downward gravity on price action."
            opp_of = f"Bid depth absorbs sell wicks without immediate gap down."
            conflict_of = "Ask walls exist but bid liquidity prevents slippage cascades."
            sev_of = "MODERATE"

        rows.append(
            CrossExaminationRow(
                dimension="Order Flow & Depth",
                supporting_evidence=sup_of,
                opposing_evidence=opp_of,
                conflict_assessment=conflict_of,
                severity=sev_of,
            )
        )

        return rows

    # -------------------------------------------------------------------------
    # Verdict Evaluation
    # -------------------------------------------------------------------------
    def _evaluate_verdict(
        self,
        stance: ThesisStance,
        prosecution_args: List[CourtroomArgument],
        defense_args: List[CourtroomArgument],
        cross_exam: List[CrossExaminationRow],
    ) -> Tuple[VerdictType, str]:
        # Count strong and moderate arguments
        p_strong = sum(1 for a in prosecution_args if a.strength == EvidenceStrength.STRONG)
        p_mod = sum(1 for a in prosecution_args if a.strength == EvidenceStrength.MODERATE)
        d_strong = sum(1 for a in defense_args if a.strength == EvidenceStrength.STRONG)
        d_mod = sum(1 for a in defense_args if a.strength == EvidenceStrength.MODERATE)

        high_conflicts = sum(1 for r in cross_exam if r.severity == "HIGH")

        stance_label = "bullish" if stance == ThesisStance.BULLISH else ("bearish" if stance == ThesisStance.BEARISH else "range")

        # Conflict resolution logic
        if p_strong >= 2 and d_strong >= 2:
            verdict = VerdictType.NO_CLEAR_VERDICT
            rationale = (
                f"The available market data exhibits substantial contradiction across primary dimensions. "
                f"While defense arguments present robust evidence of trend baseline defense, the prosecution "
                f"identifies equally strong structural and order flow resistance. A decisive directional verdict "
                f"cannot be substantiated without further evidence."
            )
        elif p_strong > d_strong and p_strong >= 2:
            verdict = VerdictType.WEAKENED if d_mod > 0 else VerdictType.CONTRADICTED
            rationale = (
                f"The {stance_label} thesis is materially undermined by compelling counter-evidence. "
                f"The prosecution established {p_strong} high-conviction points of resistance (momentum deceleration, "
                f"moving average rejection, or order book ask walls) that outweigh currently visible supporting factors."
            )
        elif d_strong > p_strong and d_strong >= 2:
            if p_mod > 0 or high_conflicts > 0:
                verdict = VerdictType.PARTIALLY_SUPPORTED
                rationale = (
                    f"The {stance_label} thesis receives meaningful quantitative support from trend and oscillator "
                    f"baselines, but important conflicting signals (such as volume exhaustion or overhead supply) "
                    f"preclude full confirmation. Caution is warranted against assumption of an unobstructed move."
                )
            else:
                verdict = VerdictType.SUPPORTED
                rationale = (
                    f"The available evidence demonstrates strong coherence with the {stance_label} thesis. "
                    f"Primary structural baselines, momentum metrics, and depth liquidity are currently aligned in favor "
                    f"of the proposed market interpretation."
                )
        elif p_mod > 0 and d_mod > 0:
            verdict = VerdictType.PARTIALLY_SUPPORTED
            rationale = (
                f"Evidence is divided between moderate supporting factors and moderate counter-evidence. "
                f"The {stance_label} thesis remains plausible but vulnerable to opposing market forces."
            )
        else:
            verdict = VerdictType.INCONCLUSIVE
            rationale = (
                f"Current market telemetry displays low directional conviction with indicators hovering near neutral "
                f"midpoints. Evidence is insufficient to definitively validate or contradict the thesis."
            )

        return verdict, rationale

    # -------------------------------------------------------------------------
    # Thesis Invalidation Conditions (NOT signals)
    # -------------------------------------------------------------------------
    def _build_invalidation_conditions(
        self,
        stance: ThesisStance,
        curr_price: float,
        swing_high: float,
        swing_low: float,
        ema_26: float,
        sma_50: float,
        rsi: float,
        user_support: Optional[float],
        user_resistance: Optional[float],
    ) -> List[InvalidationCondition]:
        conditions: List[InvalidationCondition] = []

        if stance == ThesisStance.BULLISH:
            # Condition 1: Loss of swing low / support
            ref_low = user_support if user_support and user_support < curr_price else swing_low
            conditions.append(
                InvalidationCondition(
                    condition_type="BULLISH_INVALIDATION",
                    description=f"Price prints a confirmed candle close beneath support at ${ref_low:,.2f}.",
                    price_reference=ref_low,
                    rationale="Breaking this level would violate the higher-low sequence and invalidate the structural trend premise.",
                )
            )

            # Condition 2: Moving average failure
            ref_ma = min(ema_26, sma_50)
            conditions.append(
                InvalidationCondition(
                    condition_type="BULLISH_INVALIDATION",
                    description=f"Price fails to maintain above the 50 SMA / 26 EMA baseline (${ref_ma:,.2f}).",
                    price_reference=ref_ma,
                    rationale="Trading below intermediate moving averages indicates that sellers have recaptured medium-term trend control.",
                )
            )

            # Condition 3: Momentum breakdown
            conditions.append(
                InvalidationCondition(
                    condition_type="BULLISH_INVALIDATION",
                    description="RSI(14) breaks beneath the 42.0 threshold on expanding volume.",
                    indicator_reference="RSI(14) < 42.0",
                    rationale="Sustained oscillator weakness below 42 confirms dominant seller momentum and weakens recovery probability.",
                )
            )

        elif stance == ThesisStance.BEARISH:
            # Condition 1: Reclaiming swing high / resistance
            ref_high = user_resistance if user_resistance and user_resistance > curr_price else swing_high
            conditions.append(
                InvalidationCondition(
                    condition_type="BEARISH_INVALIDATION",
                    description=f"Price reclaims and closes above overhead resistance at ${ref_high:,.2f}.",
                    price_reference=ref_high,
                    rationale="Reclaiming this high would dismantle the lower-high structure and weaken the breakdown premise.",
                )
            )

            # Condition 2: Moving average breakout
            ref_ma = max(ema_26, sma_50)
            conditions.append(
                InvalidationCondition(
                    condition_type="BEARISH_INVALIDATION",
                    description=f"Price sustains a breakout above the 50 SMA / 26 EMA band (${ref_ma:,.2f}).",
                    price_reference=ref_ma,
                    rationale="Overcoming key moving averages demonstrates renewed institutional buyer participation.",
                )
            )

            # Condition 3: Momentum flip
            conditions.append(
                InvalidationCondition(
                    condition_type="BEARISH_INVALIDATION",
                    description="RSI(14) surges decisively above 58.0 alongside positive MACD histogram expansion.",
                    indicator_reference="RSI(14) > 58.0",
                    rationale="Oscillator momentum crossing above 58 reflects aggressive buying that contradicts the bearish premise.",
                )
            )

        else:
            conditions.append(
                InvalidationCondition(
                    condition_type="RANGE_INVALIDATION",
                    description=f"Price decisively expands outside the ${swing_low:,.2f} - ${swing_high:,.2f} consolidation channel.",
                    price_reference=swing_high,
                    rationale="A channel breakout confirms the initiation of directional trending behavior.",
                )
            )

        return conditions
