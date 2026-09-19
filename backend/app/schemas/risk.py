"""Quantitative risk engine Pydantic schemas."""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class RiskLevel(str, Enum):
    """Categorical risk classifications."""
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class VaRMetrics(BaseModel):
    """Value-at-Risk (VaR) and Conditional VaR (Expected Shortfall) measurements."""
    var_95_daily: float = Field(..., description="Estimated 95% daily Value at Risk (expressed as positive loss %)")
    var_99_daily: float = Field(..., description="Estimated 99% daily Value at Risk (expressed as positive loss %)")
    cvar_95_daily: float = Field(..., description="Estimated 95% daily Conditional VaR / Expected Shortfall")
    cvar_99_daily: float = Field(..., description="Estimated 99% daily Conditional VaR / Expected Shortfall")
    parametric_var_95: float = Field(..., description="Gaussian variance-covariance 95% VaR")
    historical_var_95: float = Field(..., description="Empirical historical simulation 95% VaR")
    parametric_cvar_95: float = Field(..., description="Gaussian analytical 95% Expected Shortfall")
    historical_cvar_95: float = Field(..., description="Empirical tail mean loss beyond historical 95% VaR")
    method: str = Field(default="HYBRID", description="Primary calculation method or model consensus")


class DrawdownMetrics(BaseModel):
    """Drawdown and capital preservation analytics."""
    max_drawdown: float = Field(..., description="Maximum peak-to-trough percentage decline (negative float, e.g. -0.22)")
    current_drawdown: float = Field(..., description="Current drawdown percentage from most recent peak (negative float)")
    drawdown_duration_periods: int = Field(..., description="Number of periods currently spent below peak")
    peak_price: float = Field(..., description="Highest observed closing price in evaluated sample")
    trough_price: float = Field(..., description="Trough price during deepest observed drawdown")


class RiskAdjustedMetrics(BaseModel):
    """Risk-adjusted performance and efficiency indicators."""
    sharpe_ratio: float = Field(..., description="Annualized Sharpe ratio ((Return - Rf) / Volatility)")
    sortino_ratio: float = Field(..., description="Annualized Sortino ratio ((Return - Rf) / DownsideDeviation)")
    calmar_ratio: float = Field(..., description="Calmar ratio (Annualized Return / |Max Drawdown|)")
    annualized_return: float = Field(..., description="Compounded or arithmetic annualized rate of return")
    annualized_volatility: float = Field(..., description="Annualized realized standard deviation of returns")
    downside_deviation: float = Field(..., description="Annualized downside semi-deviation of returns below target")
    risk_free_rate: float = Field(default=0.04, description="Annualized benchmark risk-free rate assumed (default 4%)")


class SensitivityMetrics(BaseModel):
    """Cross-asset correlation and market beta sensitivity."""
    beta: float = Field(..., description="Systematic market risk sensitivity relative to benchmark asset")
    correlation_with_benchmark: float = Field(..., description="Pearson correlation coefficient with benchmark")
    benchmark_symbol: str = Field(default="BTC/USDT", description="Benchmark reference asset symbol")


class ConcentrationMetrics(BaseModel):
    """Portfolio diversity and capital concentration metrics."""
    hhi: float = Field(..., description="Herfindahl-Hirschman Index: sum of squared weights, in [1/N, 1.0]")
    normalized_hhi: float = Field(..., description="Normalized HHI index rescaled into [0.0, 1.0]")
    effective_assets: float = Field(..., description="Inverse HHI representing effective number of distinct uncorrelated bets")
    top_asset_weight: float = Field(..., description="Largest single asset percentage allocation")
    asset_weights: Dict[str, float] = Field(..., description="Map of asset symbols to normalized portfolio weights")


class PositionSizingRecommendation(BaseModel):
    """Quantitative risk-budgeted position sizing boundaries."""
    max_position_pct: float = Field(..., description="Maximum recommended allocation percentage of total portfolio capital")
    recommended_leverage: float = Field(default=1.0, description="Recommended maximum safe leverage multiplier")
    risk_budget_pct: float = Field(..., description="Targeted portfolio risk budget allocation (e.g. 0.02 for 2%)")
    volatility_scalar: float = Field(..., description="Inverse volatility scaling factor applied to baseline sizing")
    rationale: str = Field(..., description="Actionable rationale explaining position sizing recommendations")


class AssetRiskResult(BaseModel):
    """Complete quantitative risk assessment for an individual asset."""
    symbol: str = Field(..., description="Unified trading symbol")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of risk assessment",
    )
    overall_risk_score: float = Field(..., description="Composite risk index bounded in [0.0, 1.0]")
    risk_level: RiskLevel = Field(..., description="Categorical risk classification")
    volatility_daily: float = Field(..., description="Daily realized return standard deviation")
    volatility_annualized: float = Field(..., description="Annualized realized return standard deviation")
    var_metrics: VaRMetrics = Field(..., description="Value at Risk and Expected Shortfall metrics")
    drawdown_metrics: DrawdownMetrics = Field(..., description="Peak-to-trough drawdown dynamics")
    risk_adjusted_metrics: RiskAdjustedMetrics = Field(..., description="Sharpe, Sortino, and Calmar metrics")
    sensitivity_metrics: Optional[SensitivityMetrics] = Field(default=None, description="Beta and correlation metrics")
    position_sizing: PositionSizingRecommendation = Field(..., description="Risk-budgeted sizing guidance")
    risk_warnings: List[str] = Field(default_factory=list, description="Actionable risk flags or threshold breaches")
    analysis_id: Optional[str] = Field(default=None, description="UUID of persisted risk analysis database record")

    @field_validator("overall_risk_score")
    @classmethod
    def validate_risk_score(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"overall_risk_score must be in [0.0, 1.0], got {v}")
        return round(v, 4)


class PortfolioAssetInput(BaseModel):
    """Asset specification for portfolio risk assessment."""
    symbol: str = Field(..., description="Trading pair symbol (e.g. BTC/USDT)")
    weight: float = Field(..., description="Portfolio weight allocation (0.0 to 1.0)")
    quantity: Optional[float] = Field(default=None, description="Nominal units held")
    avg_entry_price: Optional[float] = Field(default=None, description="Average entry cost basis")

    @field_validator("symbol")
    @classmethod
    def clean_symbol(cls, v: str) -> str:
        s = v.strip().upper()
        if not s:
            raise ValueError("symbol must not be empty")
        return s

    @field_validator("weight")
    @classmethod
    def validate_weight(cls, v: float) -> float:
        if v < 0.0:
            raise ValueError(f"Asset weight must be non-negative, got {v}")
        return v


class PortfolioRiskRequest(BaseModel):
    """Request payload for evaluating custom portfolio risk."""
    assets: List[PortfolioAssetInput] = Field(..., description="List of portfolio asset holdings")
    benchmark_symbol: str = Field(default="BTC/USDT", description="Benchmark reference symbol for beta calculations")
    timeframe: str = Field(default="1h", description="Candle timeframe for historical return series")
    lookback_candles: int = Field(default=100, ge=30, le=500, description="Number of candles for historical analysis")
    target_volatility: float = Field(default=0.20, description="Target annualized portfolio volatility for sizing")
    portfolio_name: Optional[str] = Field(default=None, description="Optional descriptive portfolio name")


class PortfolioRiskResult(BaseModel):
    """Complete portfolio quantitative risk assessment."""
    portfolio_id: Optional[str] = Field(default=None, description="Database UUID if evaluating a persisted portfolio")
    portfolio_name: Optional[str] = Field(default=None, description="Portfolio name or identifier")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp of risk assessment",
    )
    overall_risk_score: float = Field(..., description="Composite portfolio risk score bounded in [0.0, 1.0]")
    risk_level: RiskLevel = Field(..., description="Categorical portfolio risk level")
    portfolio_volatility_annualized: float = Field(..., description="Annualized portfolio standard deviation")
    portfolio_var_95_daily: float = Field(..., description="Portfolio-level 95% 1-day Value at Risk")
    portfolio_cvar_95_daily: float = Field(..., description="Portfolio-level 95% 1-day Conditional VaR")
    portfolio_sharpe_ratio: float = Field(..., description="Annualized portfolio Sharpe ratio")
    portfolio_sortino_ratio: float = Field(..., description="Annualized portfolio Sortino ratio")
    max_drawdown: float = Field(..., description="Portfolio-level maximum historical drawdown")
    concentration: ConcentrationMetrics = Field(..., description="Herfindahl and asset distribution metrics")
    marginal_risk_contributions: Dict[str, float] = Field(
        ...,
        description="Percentage contribution of each asset to total portfolio variance",
    )
    component_risks: Dict[str, AssetRiskResult] = Field(
        ...,
        description="Individual risk breakdowns for each underlying asset",
    )
    risk_warnings: List[str] = Field(default_factory=list, description="Actionable risk flags or threshold breaches")
    analysis_id: Optional[str] = Field(default=None, description="UUID of persisted risk analysis database record")

    @field_validator("overall_risk_score")
    @classmethod
    def validate_risk_score(cls, v: float) -> float:
        if not (0.0 <= v <= 1.0):
            raise ValueError(f"overall_risk_score must be in [0.0, 1.0], got {v}")
        return round(v, 4)


class RiskHistoryItem(BaseModel):
    """Historical persisted risk analysis record for audit and reporting."""
    id: str = Field(..., description="Record UUID")
    target_type: str = Field(..., description="ASSET or PORTFOLIO")
    target_id: str = Field(..., description="Symbol or portfolio UUID")
    overall_risk: float = Field(..., description="Overall risk index [0.0, 1.0]")
    volatility: float = Field(..., description="Annualized volatility")
    var_95: Optional[float] = Field(default=None, description="95% Value at Risk")
    cvar_95: Optional[float] = Field(default=None, description="95% Conditional VaR")
    max_drawdown: Optional[float] = Field(default=None, description="Max drawdown")
    sharpe_ratio: Optional[float] = Field(default=None, description="Sharpe ratio")
    sortino_ratio: Optional[float] = Field(default=None, description="Sortino ratio")
    beta: Optional[float] = Field(default=None, description="Beta relative to benchmark")
    concentration_risk: Optional[float] = Field(default=None, description="Concentration index (HHI)")
    timestamp: datetime = Field(..., description="Timestamp of analysis")
    metrics_payload: Dict[str, Any] = Field(default_factory=dict, description="Detailed JSON calculation payload")
