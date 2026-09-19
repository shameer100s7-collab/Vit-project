"""Pydantic schemas for quantitative feature sets and point-in-time snapshots."""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class FeatureSnapshot(BaseModel):
    """Point-in-time normalized feature values for model inference and strategy evaluation."""
    symbol: str = Field(..., description="Asset symbol")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of feature observation",
    )
    feature_version: str = Field(default="v1.0", description="Feature schema specification version")
    features: Dict[str, float] = Field(..., description="Calculated indicator values")
    warmup_periods_used: int = Field(..., description="Number of historical candles consumed")


class FeatureMetadata(BaseModel):
    """Documentation and parameter definitions for an individual indicator feature."""
    name: str = Field(..., description="Feature identifier")
    category: str = Field(..., description="Indicator category (e.g. MOMENTUM, VOLATILITY, TREND, VOLUME)")
    description: str = Field(..., description="Mathematical and quantitative rationale")
    lookback_window: int = Field(..., description="Number of trailing periods required for warm-up")
