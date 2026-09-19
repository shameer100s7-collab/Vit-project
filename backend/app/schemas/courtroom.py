"""Pydantic schemas for the GHOST Courtroom adversarial market reasoning engine."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class EvidenceHierarchy(str, Enum):
    """Hierarchical classification of evidence credibility and abstraction."""
    DIRECT_OBSERVATION = "Direct market observation"
    DERIVED_INDICATOR = "Derived indicator"
    MODEL_INTERPRETATION = "Model interpretation"
    EXTERNAL_INFO = "External information"


class EvidenceStrength(str, Enum):
    """Calibrated, human-readable evidence strength rating."""
    STRONG = "Strong"
    MODERATE = "Moderate"
    WEAK = "Weak"
    INSUFFICIENT = "Insufficient"


class EvidenceDirection(str, Enum):
    """Directional relationship of an evidence item relative to the user thesis."""
    SUPPORTING = "Supporting"
    OPPOSING = "Opposing"
    NEUTRAL = "Neutral"


class VerdictType(str, Enum):
    """Categorical assessment of market thesis evidence. Never a buy/sell trade recommendation."""
    SUPPORTED = "SUPPORTED"
    PARTIALLY_SUPPORTED = "PARTIALLY SUPPORTED"
    WEAKENED = "WEAKENED"
    CONTRADICTED = "CONTRADICTED"
    INCONCLUSIVE = "INCONCLUSIVE"
    NO_CLEAR_VERDICT = "NO CLEAR VERDICT"


class ThesisStance(str, Enum):
    """Detected directional stance of the user's natural language thesis."""
    BULLISH = "BULLISH"
    BEARISH = "BEARISH"
    NEUTRAL_OR_RANGE = "NEUTRAL_OR_RANGE"


class CourtroomEvidenceItem(BaseModel):
    """Granular piece of verifiable market evidence underpinning an argument."""
    id: str = Field(..., description="Unique evidence item identifier")
    type: str = Field(..., description="Category of evidence (indicator, price_action, volume, orderbook, etc.)")
    hierarchy: EvidenceHierarchy = Field(..., description="Evidence hierarchy tier")
    name: str = Field(..., description="Display name of the feature or metric")
    value: Any = Field(..., description="Observed raw or formatted numerical/categorical value")
    threshold_or_condition: Optional[str] = Field(None, description="Benchmark or threshold condition evaluated")
    observation: str = Field(..., description="Factual observation derived from data")
    direction: EvidenceDirection = Field(..., description="Relationship to user thesis")
    strength: EvidenceStrength = Field(..., description="Calibrated strength")
    source: str = Field(..., description="Authoritative origin of data (e.g. Binance Spot)")
    event_time: datetime = Field(..., description="Timestamp of the market data observation")
    retrieved_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when evidence was ingested",
    )
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional context parameters")


class CourtroomArgument(BaseModel):
    """Adversarial argument presented by either Prosecution or Defense counsel."""
    id: str = Field(..., description="Unique argument ID")
    role: str = Field(..., description="PROSECUTION or DEFENSE")
    claim: str = Field(..., description="Central claim of this argument")
    observation: str = Field(..., description="Data observation supporting the claim")
    why_it_matters: str = Field(..., description="Impact on the user's thesis")
    strength: EvidenceStrength = Field(..., description="Overall argument strength")
    source: str = Field(..., description="Primary data source attribution")
    updated_ago: str = Field(..., description="Freshness label (e.g. 0.4s ago)")
    evidence_items: List[CourtroomEvidenceItem] = Field(
        default_factory=list,
        description="Linked verifiable evidence items with raw metrics",
    )


class CrossExaminationRow(BaseModel):
    """Dimensional comparison contrasting evidence FOR and AGAINST the thesis."""
    dimension: str = Field(..., description="Analytical dimension (Momentum, Trend, Volume, etc.)")
    supporting_evidence: str = Field(..., description="Summary of evidence in favor of thesis")
    opposing_evidence: str = Field(..., description="Summary of evidence against thesis")
    conflict_assessment: str = Field(..., description="Evaluated contradiction or alignment")
    severity: str = Field(..., description="Severity level: HIGH, MODERATE, LOW, or ALIGNED")


class InvalidationCondition(BaseModel):
    """Explicit, verifiable market condition that would invalidate the thesis (NOT a trading signal)."""
    condition_type: str = Field(..., description="Type of invalidation (e.g. BULLISH_INVALIDATION)")
    description: str = Field(..., description="Objective condition description")
    price_reference: Optional[float] = Field(None, description="Specific price boundary if applicable")
    indicator_reference: Optional[str] = Field(None, description="Indicator threshold if applicable")
    rationale: str = Field(..., description="Reason this condition breaks the premise of the thesis")


class CourtroomCaseCreate(BaseModel):
    """User submission to initiate a Courtroom session."""
    symbol: str = Field(..., description="Asset trading pair (e.g. BTCUSDT, ETH/USDT)")
    timeframe: str = Field(default="4h", description="Evaluated timeframe: 5m, 15m, 1h, 4h, 1D, 1W")
    thesis: str = Field(..., min_length=3, max_length=1000, description="Natural language market thesis")
    notes: Optional[str] = Field(None, max_length=2000, description="Optional user notes or contextual clues")
    support_level: Optional[float] = Field(None, description="Optional user-provided support level")
    resistance_level: Optional[float] = Field(None, description="Optional user-provided resistance level")
    screenshot_data: Optional[str] = Field(None, description="Optional client-uploaded chart image (base64)")


class CourtroomCase(BaseModel):
    """Complete GHOST Courtroom adversarial proceeding record."""
    case_id: str = Field(..., description="Unique case number, e.g. CASE-GHOST-1042")
    symbol: str = Field(..., description="Asset symbol")
    timeframe: str = Field(..., description="Timeframe of analysis")
    user_thesis: str = Field(..., description="User's original thesis statement")
    user_notes: Optional[str] = Field(None, description="User's notes if provided")
    detected_stance: ThesisStance = Field(..., description="Interpreted thesis stance")
    status: str = Field(default="IN_SESSION", description="Case status: IN_SESSION or CONCLUDED")
    market_snapshot: Dict[str, Any] = Field(
        default_factory=dict,
        description="Real market prices, 24h stats, and timestamp at time of case opening",
    )
    prosecution_arguments: List[CourtroomArgument] = Field(
        default_factory=list,
        description="Prosecution arguments challenging the thesis",
    )
    defense_arguments: List[CourtroomArgument] = Field(
        default_factory=list,
        description="Defense arguments supporting the thesis",
    )
    cross_examination: List[CrossExaminationRow] = Field(
        default_factory=list,
        description="Side-by-side comparison of conflicting factors",
    )
    verdict: VerdictType = Field(..., description="Final evidence-based verdict")
    verdict_rationale: str = Field(..., description="Detailed explanation of the verdict")
    invalidation_conditions: List[InvalidationCondition] = Field(
        default_factory=list,
        description="Conditions that would invalidate the thesis",
    )
    data_sources: List[str] = Field(default_factory=list, description="Authoritative data sources consulted")
    evidence_count: int = Field(default=0, description="Total pieces of evidence evaluated")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Case inception timestamp",
    )
