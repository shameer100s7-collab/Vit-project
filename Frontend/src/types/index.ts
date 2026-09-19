/**
 * Complete GHOST Frontend TypeScript Definitions
 * Directly aligned with FastAPI / Pydantic schemas across all subsystems.
 */

// ==========================================
// 1. Common Response Envelopes
// ==========================================
export interface StandardSuccessResponse<T> {
  success: true;
  data: T;
  metadata: Record<string, any>;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: any;
}

export interface StandardErrorResponse {
  success: false;
  error: ErrorDetail;
  request_id: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
  environment?: string;
  database?: string;
}

// ==========================================
// 2. Authentication & Identity
// ==========================================
export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: 'ADMIN' | 'ANALYST' | 'USER';
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserLoginRequest {
  email: string;
  password: string;
}

export interface UserRegisterRequest {
  email: string;
  password: string;
  full_name?: string;
  role?: 'ADMIN' | 'ANALYST' | 'USER';
}

// ==========================================
// 3. Market Data Engine
// ==========================================
export interface CanonicalPrice {
  symbol: string;
  price: number;
  timestamp: string;
  source: string;
}

export interface CanonicalCandle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface CanonicalOrderBook {
  symbol: string;
  timestamp: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spread_pct: number;
}

export interface CanonicalVolume {
  symbol: string;
  volume_24h: number;
  quote_volume_24h: number;
  price_change_pct_24h: number;
  high_24h: number;
  low_24h: number;
  timestamp: string;
}

export interface CanonicalMarketOverviewItem {
  symbol: string;
  price: number;
  price_change_pct_24h: number;
  volume_24h: number;
  high_24h: number;
  low_24h: number;
}

export interface CanonicalMarketOverview {
  timestamp: string;
  assets: CanonicalMarketOverviewItem[];
}

export interface CanonicalAssetMetadata {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  price_precision: number;
  quantity_precision: number;
  min_order_quantity: number;
  is_active: boolean;
}

// ==========================================
// 4. Market State & Feature Engine
// ==========================================
export type MarketState =
  | 'BULLISH_TREND'
  | 'BEARISH_TREND'
  | 'SIDEWAYS'
  | 'HIGH_VOLATILITY'
  | 'LOW_VOLATILITY'
  | 'ACCUMULATION_LIKE'
  | 'DISTRIBUTION_LIKE'
  | 'UNCERTAIN';

export interface EvidenceItem {
  indicator_name: string;
  observed_value: number;
  threshold: number;
  supports_state: boolean;
  rationale: string;
}

export interface MarketStateScores {
  bullish_trend: number;
  bearish_trend: number;
  sideways: number;
  high_volatility: number;
  low_volatility: number;
  accumulation_like: number;
  distribution_like: number;
}

export interface MarketStateResult {
  symbol: string;
  timestamp: string;
  state: MarketState;
  confidence: number;
  evidence: EvidenceItem[];
  scores: MarketStateScores;
  conflict_detected: boolean;
  conflict_reasons: string[];
  features_used: Record<string, number>;
  model_version: string;
}

// ==========================================
// 5. Quantitative Signal Engine
// ==========================================
export type SignalDirection = 'LONG' | 'SHORT' | 'HOLD' | 'NEUTRAL';
export type TimeHorizon = 'VERY_SHORT_TERM' | 'SHORT_TERM' | 'MEDIUM_TERM' | 'LONG_TERM';

export interface StrategySignal {
  strategy_name: string;
  direction: SignalDirection;
  confidence: number;
  strength: number;
  reasons: string[];
  metrics: Record<string, any>;
}

export interface AggregatedSignalResult {
  asset: string;
  timestamp: string;
  direction: SignalDirection;
  confidence: number;
  strength: number;
  time_horizon: TimeHorizon;
  market_state: string;
  consensus_metrics: {
    strategies_evaluated: number;
    directional_scores: Record<string, number>;
    agreement_ratio: number;
    dominant_strategy: string;
    domination_guard_applied: boolean;
  };
  strategy_signals: StrategySignal[];
}

export interface SignalHistoryItem {
  id: string;
  symbol: string;
  direction: SignalDirection;
  confidence: number;
  strength: number;
  time_horizon: string;
  reasons: string[];
  status: string;
  model_version: string;
  timestamp: string;
}

// ==========================================
// 6. Observable Behavior Model
// ==========================================
export type BehaviorState =
  | 'ACCUMULATION_LIKE'
  | 'DISTRIBUTION_LIKE'
  | 'LIQUIDITY_HUNTING'
  | 'RETAIL_FOMO'
  | 'RETAIL_PANIC'
  | 'MARKET_MAKING_BALANCED'
  | 'NEUTRAL_INACTIVE'
  | 'UNCERTAIN';

export interface ObservationItem {
  metric: string;
  observed_value: number;
  unit: string;
  context: string;
  is_factual: boolean;
}

export interface LiquidityPressure {
  depth_asymmetry: number;
  bid_depth_total: number;
  ask_depth_total: number;
  net_imbalance: number;
  spread_bps: number;
  depth_resilience: number;
}

export interface WhaleActivityIndicator {
  whale_activity_score: number;
  large_resting_walls_count: number;
  volume_concentration_ratio: number;
  absorption_ratio: number;
  detected_walls: Array<{
    side: string;
    price: number;
    size: number;
    ratio_to_avg: number;
  }>;
}

export interface ParticipantActivity {
  archetype: string;
  activity_level: string;
  dominance_score: number;
  observed_patterns: string[];
}

export interface BehaviorAnalysisResult {
  symbol: string;
  timestamp: string;
  primary_behavior_state: BehaviorState;
  state_confidence: number;
  observations: ObservationItem[];
  liquidity_pressure: LiquidityPressure;
  whale_activity: WhaleActivityIndicator;
  participant_inferences: ParticipantActivity[];
  game_theoretic_summary: string;
  regime_context: string;
}

// ==========================================
// 7. Quantitative Risk Engine
// ==========================================
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export interface VaRMetrics {
  var_95_daily: number;
  var_99_daily: number;
  cvar_95_daily: number;
  cvar_99_daily: number;
  parametric_var_95: number;
  historical_var_95: number;
  parametric_cvar_95: number;
  historical_cvar_95: number;
  method: string;
}

export interface DrawdownMetrics {
  max_drawdown: number;
  current_drawdown: number;
  drawdown_duration_periods: number;
  peak_price: number;
  trough_price: number;
}

export interface RiskAdjustedMetrics {
  sharpe_ratio: number;
  sortino_ratio: number;
  calmar_ratio: number;
  annualized_return: number;
  annualized_volatility: number;
  downside_deviation: number;
  risk_free_rate: number;
}

export interface SensitivityMetrics {
  beta: number;
  correlation_with_benchmark: number;
  benchmark_symbol: string;
}

export interface ConcentrationMetrics {
  hhi: number;
  normalized_hhi: number;
  effective_assets: number;
  top_asset_weight: number;
  asset_weights: Record<string, number>;
}

export interface PositionSizingRecommendation {
  max_position_pct: number;
  recommended_leverage: number;
  risk_budget_pct: number;
  volatility_scalar: number;
  rationale: string;
}

export interface AssetRiskResult {
  symbol: string;
  timestamp: string;
  overall_risk_score: number;
  risk_level: RiskLevel;
  volatility_daily: number;
  volatility_annualized: number;
  var_metrics: VaRMetrics;
  drawdown_metrics: DrawdownMetrics;
  risk_adjusted_metrics: RiskAdjustedMetrics;
  sensitivity_metrics?: SensitivityMetrics;
  position_sizing: PositionSizingRecommendation;
  risk_warnings: string[];
  analysis_id?: string;
}

export interface PortfolioAssetInput {
  symbol: string;
  weight: number;
  quantity?: number;
  avg_entry_price?: number;
}

export interface PortfolioRiskRequest {
  assets: PortfolioAssetInput[];
  benchmark_symbol?: string;
  timeframe?: string;
  lookback_candles?: number;
  target_volatility?: number;
  portfolio_name?: string;
}

export interface PortfolioRiskResult {
  portfolio_id?: string;
  portfolio_name?: string;
  timestamp: string;
  overall_risk_score: number;
  risk_level: RiskLevel;
  portfolio_volatility_annualized: number;
  portfolio_var_95_daily: number;
  portfolio_cvar_95_daily: number;
  portfolio_sharpe_ratio: number;
  portfolio_sortino_ratio: number;
  max_drawdown: number;
  concentration: ConcentrationMetrics;
  marginal_risk_contributions: Record<string, number>;
  component_risks: Record<string, AssetRiskResult>;
  risk_warnings: string[];
  analysis_id?: string;
}

export interface RiskHistoryItem {
  id: string;
  target_type: string;
  target_id: string;
  overall_risk: number;
  volatility: number;
  var_95?: number;
  cvar_95?: number;
  max_drawdown?: number;
  sharpe_ratio?: number;
  sortino_ratio?: number;
  beta?: number;
  concentration_risk?: number;
  timestamp: string;
  metrics_payload: Record<string, any>;
}
