"""Pydantic schemas for GHOST Signal Market Context Engine.

Eliminates generic buy/sell prediction signals and focuses on structured,
evidence-based market context extracted from chart screenshots and real telemetry.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class EvidenceQuality(str, Enum):
    """Quality rating of the visual chart evidence provided."""
    HIGH = "HIGH"
    MODERATE = "MODERATE"
    LIMITED = "LIMITED"
    INSUFFICIENT = "INSUFFICIENT"


class MarketContextState(str, Enum):
    """Objective classification of the observed market condition (never a trading recommendation)."""
    TRENDING = "TRENDING"
    RANGING = "RANGING"
    COMPRESSING = "COMPRESSING"
    EXPANDING = "EXPANDING"
    TRANSITIONING = "TRANSITIONING"
    REJECTING = "REJECTING"
    CONSOLIDATING = "CONSOLIDATING"
    MIXED_UNCLEAR = "MIXED / UNCLEAR"


class MarketStateContext(BaseModel):
    """Primary market state classification with explanatory summary."""
    state: MarketContextState = Field(..., description="Observed market state")
    summary: str = Field(..., description="Concise explanation of the state")


class MarketMap(BaseModel):
    """Hierarchical breakdown across primary market dimensions."""
    price: str = Field(..., description="Observable price behavior (expansion, contraction, rejection, etc.)")
    structure: str = Field(..., description="Visible structural state (Higher High/Low, Range, Breakout, etc.)")
    time: str = Field(..., description="Duration and relative age of move or consolidation")
    volume: str = Field(..., description="Volume participation or confirmation (or 'Volume context unavailable')")
    range: str = Field(..., description="Range behavior (expanding, contracting, large/small candles)")
    location: str = Field(..., description="Location of price relative to visible structure")
    candle_behavior: str = Field(..., description="Wick rejections, body expansions, indecision")


class ScreenshotQualityGateResult(BaseModel):
    """Outcome of visual screenshot quality inspection."""
    quality_gate_passed: bool = Field(..., description="Whether screenshot meets minimum visual standards")
    clarity_rating: EvidenceQuality = Field(..., description="Visual clarity rating")
    reasons: List[str] = Field(default_factory=list, description="Passed or failing inspection reasons")
    candle_bodies_visible: bool = Field(default=True, description="Whether candle bodies are discernible")
    wicks_visible: bool = Field(default=True, description="Whether upper and lower wicks are visible")
    volume_visible: bool = Field(default=True, description="Whether volume bars are present and readable")
    price_scale_visible: bool = Field(default=True, description="Whether price/time axes are legible")
    error_title: Optional[str] = Field(None, description="Header for failure UI, e.g. CHART CLARITY INSUFFICIENT")
    error_message: Optional[str] = Field(None, description="Detailed guidance for uploading a clearer screenshot")


class MultiTimeframeLevel(BaseModel):
    """Structural summary of an individual timeframe in a multi-timeframe analysis."""
    timeframe: str = Field(..., description="Candle timeframe, e.g. 1D, 4H, 1H, 15M")
    structure_summary: str = Field(..., description="Observable structural behavior on this timeframe")
    context_role: str = Field(..., description="Role: HIGHER_TIMEFRAME, INTERMEDIATE_TIMEFRAME, CURRENT_TIMEFRAME, LOCAL_BEHAVIOR")


class TimeframeScreenshot(BaseModel):
    """An auxiliary screenshot for multi-timeframe synthesis."""
    timeframe: str = Field(..., description="Timeframe label, e.g. 1D, 4H")
    image_data: str = Field(..., description="Base64-encoded image string")


class MarketContextRequest(BaseModel):
    """User submission requesting market context analysis from chart screenshot."""
    asset: str = Field(..., description="Asset symbol (e.g. BTC/USDT)")
    timeframe: str = Field(..., description="Primary timeframe being analyzed (e.g. 1H, 4H, 1D)")
    image_data: str = Field(..., description="Base64-encoded chart screenshot")
    has_volume: Optional[bool] = Field(default=True, description="Whether volume is included in the screenshot")
    secondary_screenshots: Optional[List[TimeframeScreenshot]] = Field(
        default=None,
        description="Optional additional timeframe screenshots for hierarchical synthesis",
    )


class MarketContextResult(BaseModel):
    """Complete structured market context analysis matching prompt requirements."""
    asset: str = Field(..., description="Asset analyzed")
    timeframe: str = Field(..., description="Timeframe analyzed")
    evidence_quality: EvidenceQuality = Field(..., description="Quality of supplied evidence (HIGH, MODERATE, LIMITED, INSUFFICIENT)")
    market_state: MarketStateContext = Field(..., description="Primary market state and explanation")
    market_map: MarketMap = Field(..., description="Observation map across 7 primary dimensions")
    supporting_evidence: List[str] = Field(default_factory=list, description="3-5 observations supporting current context")
    conflicting_evidence: List[str] = Field(default_factory=list, description="3-5 observations limiting or complicating interpretation")
    current_context: str = Field(..., description="2-4 concise sentences synthesizing the market")
    what_to_watch: List[str] = Field(default_factory=list, description="Observable conditions that would change the context (never trade commands)")
    limitations: List[str] = Field(default_factory=list, description="Explicitly disclosed data limitations if any")
    quality_gate: ScreenshotQualityGateResult = Field(..., description="Quality gate inspection record")
    multi_timeframe_synthesis: Optional[str] = Field(None, description="Hierarchical multi-timeframe synthesis if provided")
    multi_timeframe_levels: Optional[List[MultiTimeframeLevel]] = Field(None, description="Timeframe structural breakdown")
    live_market_comparison: Optional[Dict[str, Any]] = Field(None, description="Comparison with live Binance Spot ticker if available")
    visual_analysis: Optional[Dict[str, Any]] = Field(None, description="Detailed visual chart telemetry and cross-check")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Analysis generation timestamp")
