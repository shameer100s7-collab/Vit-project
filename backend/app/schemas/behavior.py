"""Pydantic schemas for observable market participant behavior and game-theoretic analysis."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class BehaviorState(str, Enum):
    """Observable participant behavioral regimes."""
    ACCUMULATION_LIKE = "ACCUMULATION_LIKE"
    DISTRIBUTION_LIKE = "DISTRIBUTION_LIKE"
    LIQUIDITY_HUNTING = "LIQUIDITY_HUNTING"
    RETAIL_FOMO = "RETAIL_FOMO"
    RETAIL_PANIC = "RETAIL_PANIC"
    MARKET_MAKING_BALANCED = "MARKET_MAKING_BALANCED"
    NEUTRAL_INACTIVE = "NEUTRAL_INACTIVE"
    UNCERTAIN = "UNCERTAIN"


class ParticipantArchetype(str, Enum):
    """Inferred participant flow archetype based on observable microstructure footprints."""
    RETAIL_DOMINATED = "RETAIL_DOMINATED"
    INSTITUTIONAL_ACCUMULATION = "INSTITUTIONAL_ACCUMULATION"
    INSTITUTIONAL_DISTRIBUTION = "INSTITUTIONAL_DISTRIBUTION"
    WHALE_PASSIVE_ABSORPTION = "WHALE_PASSIVE_ABSORPTION"
    ALGORITHMIC_HIGH_FREQUENCY = "ALGORITHMIC_HIGH_FREQUENCY"
    LIQUIDITY_PROVIDER_ACTIVE = "LIQUIDITY_PROVIDER_ACTIVE"
    MIXED_UNRESOLVED = "MIXED_UNRESOLVED"


class ObservationItem(BaseModel):
    """Objective factual market observation directly derived from data.

    Rigorously separated from model inferences to prevent cognitive conflation.
    """
    metric: str = Field(..., description="Observed quantitative metric identifier")
    value: float = Field(..., description="Observed numerical value")
    interpretation: str = Field(..., description="Factual description of what the data shows without speculative intent")
    source: str = Field(..., description="Data source category: ORDERBOOK, VOLUME, PRICE_ACTION, VOLATILITY")


class LiquidityPressure(BaseModel):
    """Microstructure depth asymmetry and order book liquidity metrics."""
    bid_pressure: float = Field(..., ge=0.0, description="Normalized cumulative buyer bid liquidity")
    ask_pressure: float = Field(..., ge=0.0, description="Normalized cumulative seller ask liquidity")
    net_imbalance: float = Field(..., ge=-1.0, le=1.0, description="Normalized net depth imbalance [-1.0, 1.0]")
    spread_bps: float = Field(..., ge=0.0, description="Bid-ask spread expressed in basis points")
    depth_resilience: str = Field(..., description="Book resilience classification: HIGH, MODERATE, FRAGILE, ASYMMETRIC")


class WhaleActivityIndicator(BaseModel):
    """Observable footprints of large-block market participants and liquidity clusters."""
    wall_detected: bool = Field(default=False, description="Presence of localized large resting limit block")
    wall_side: Optional[str] = Field(default=None, description="Order book side of detected limit block: BID, ASK, or None")
    concentration_score: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Depth concentration relative to historical baseline [0.0, 1.0]",
    )
    absorption_ratio: float = Field(
        default=0.0,
        ge=0.0,
        description="Trading turnover volume absorbed per unit of price displacement",
    )
    large_order_clustering: bool = Field(default=False, description="Clustering of depth at key psychological price thresholds")


class BehaviorAnalysisResult(BaseModel):
    """Comprehensive observable participant behavior analysis and game-theoretic inference."""
    symbol: str = Field(..., description="Asset ticker symbol")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of behavioral evaluation",
    )
    behavior_state: BehaviorState = Field(..., description="Inferred probabilistic behavioral state")
    confidence: float = Field(
        ...,
        ge=0.05,
        le=0.95,
        description="Bounded model confidence [0.05, 0.95] reflecting footprint clarity",
    )
    primary_participant: ParticipantArchetype = Field(
        ...,
        description="Dominant inferred participant archetype",
    )
    summary: str = Field(..., description="Human-readable synthesis explaining the observable footprint")
    observations: List[ObservationItem] = Field(
        default_factory=list,
        description="Raw factual observations directly extracted from data",
    )
    participant_breakdown: Dict[str, float] = Field(
        default_factory=dict,
        description="Probabilistic distribution across participant archetypes",
    )
    liquidity_pressure: LiquidityPressure = Field(..., description="Order book liquidity metrics")
    whale_activity: WhaleActivityIndicator = Field(..., description="Large holder and depth cluster indicators")
    timeframe: str = Field(default="1h", description="Candle interval evaluated")
    model_version: str = Field(default="v1.0", description="Behavior model version")

    @field_validator("confidence")
    @classmethod
    def validate_confidence_bounds(cls, v: float) -> float:
        """Enforces mathematical bound [0.05, 0.95]. Confidence can never be 1.0 or 0.0."""
        if v < 0.05 or v > 0.95:
            raise ValueError(f"Confidence score {v} violates strict quantitative bounds [0.05, 0.95]")
        return round(v, 4)
