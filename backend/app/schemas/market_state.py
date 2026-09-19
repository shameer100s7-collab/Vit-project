"""Pydantic schemas for quantitative market state intelligence and regime classification."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class MarketState(str, Enum):
    """Analytical market regimes and structural conditions.

    Evaluates the current market environment objectively without predicting raw Buy/Sell.
    """
    BULLISH_TREND = "BULLISH_TREND"
    BEARISH_TREND = "BEARISH_TREND"
    SIDEWAYS = "SIDEWAYS"
    HIGH_VOLATILITY = "HIGH_VOLATILITY"
    LOW_VOLATILITY = "LOW_VOLATILITY"
    ACCUMULATION_LIKE = "ACCUMULATION_LIKE"
    DISTRIBUTION_LIKE = "DISTRIBUTION_LIKE"
    UNCERTAIN = "UNCERTAIN"


class EvidenceItem(BaseModel):
    """Granular quantitative evidence supporting or opposing a market regime."""
    indicator: str = Field(..., description="Technical indicator or feature identifier (e.g. 'RSI_14', 'EMA_CROSS')")
    value: float = Field(..., description="Observed numerical value of the indicator")
    condition: str = Field(..., description="Evaluated threshold or logical condition (e.g. '> 55.0')")
    interpretation: str = Field(..., description="Quantitative rationale for this observation")
    supports_state: MarketState = Field(..., description="Market regime supported by this evidence")
    weight: float = Field(default=1.0, ge=0.0, description="Relative significance/weight of this evidence item")


class MarketStateScores(BaseModel):
    """Normalized aggregate scores across all possible market states."""
    bullish_trend: float = Field(default=0.0, ge=0.0, description="Evidence score for BULLISH_TREND")
    bearish_trend: float = Field(default=0.0, ge=0.0, description="Evidence score for BEARISH_TREND")
    sideways: float = Field(default=0.0, ge=0.0, description="Evidence score for SIDEWAYS")
    high_volatility: float = Field(default=0.0, ge=0.0, description="Evidence score for HIGH_VOLATILITY")
    low_volatility: float = Field(default=0.0, ge=0.0, description="Evidence score for LOW_VOLATILITY")
    accumulation_like: float = Field(default=0.0, ge=0.0, description="Evidence score for ACCUMULATION_LIKE")
    distribution_like: float = Field(default=0.0, ge=0.0, description="Evidence score for DISTRIBUTION_LIKE")
    uncertain: float = Field(default=0.0, ge=0.0, description="Evidence score for UNCERTAIN")


class MarketStateResult(BaseModel):
    """Comprehensive market regime classification result with evidence-based reasoning."""
    symbol: str = Field(..., description="Asset symbol (e.g. BTCUSDT)")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of regime classification",
    )
    state: MarketState = Field(..., description="Classified dominant market regime")
    confidence: float = Field(
        ...,
        ge=0.05,
        le=0.95,
        description="Bounded confidence metric (0.05 <= c <= 0.95) reflecting evidence strength and signal coherence",
    )
    primary_rationale: str = Field(..., description="Human-readable synthesis of why this state was selected")
    conflict_detected: bool = Field(default=False, description="Flag indicating significant contradictory signals")
    conflict_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Degree of signal divergence / contradiction (0.0 = unanimous, 1.0 = maximal conflict)",
    )
    evidence: List[EvidenceItem] = Field(
        default_factory=list,
        description="Ranked list of indicator observations supporting the regime",
    )
    state_scores: Dict[str, float] = Field(
        default_factory=dict,
        description="Aggregate numerical scores for all evaluated regimes",
    )
    timeframe: str = Field(default="1h", description="Candle timeframe used for evaluation")
    warmup_periods_used: int = Field(default=0, description="Number of historical candles consumed")

    @field_validator("confidence")
    @classmethod
    def validate_confidence_bounds(cls, v: float) -> float:
        """Enforces mathematical bound [0.05, 0.95]. Confidence can never be 1.0 or 0.0."""
        if v < 0.05 or v > 0.95:
            raise ValueError(f"Confidence score {v} violates strict quantitative bounds [0.05, 0.95]")
        return round(v, 4)
