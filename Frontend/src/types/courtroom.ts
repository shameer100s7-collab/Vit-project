export type EvidenceHierarchy =
  | 'Direct market observation'
  | 'Derived indicator'
  | 'Model interpretation'
  | 'External information';

export type EvidenceStrength = 'Strong' | 'Moderate' | 'Weak' | 'Insufficient';

export type EvidenceDirection = 'Supporting' | 'Opposing' | 'Neutral';

export type VerdictType =
  | 'SUPPORTED'
  | 'PARTIALLY SUPPORTED'
  | 'WEAKENED'
  | 'CONTRADICTED'
  | 'INCONCLUSIVE'
  | 'NO CLEAR VERDICT';

export type ThesisStance = 'BULLISH' | 'BEARISH' | 'NEUTRAL_OR_RANGE';

export interface CourtroomEvidenceItem {
  id: string;
  type: string;
  hierarchy: EvidenceHierarchy;
  name: string;
  value: any;
  threshold_or_condition?: string;
  observation: string;
  direction: EvidenceDirection;
  strength: EvidenceStrength;
  source: string;
  event_time: string;
  retrieved_at: string;
  metadata?: Record<string, any>;
}

export interface CourtroomArgument {
  id: string;
  role: 'PROSECUTION' | 'DEFENSE';
  claim: string;
  observation: string;
  why_it_matters: string;
  strength: EvidenceStrength;
  source: string;
  updated_ago: string;
  evidence_items: CourtroomEvidenceItem[];
}

export interface CrossExaminationRow {
  dimension: string;
  supporting_evidence: string;
  opposing_evidence: string;
  conflict_assessment: string;
  severity: 'HIGH' | 'MODERATE' | 'LOW' | 'ALIGNED';
}

export interface InvalidationCondition {
  condition_type: string;
  description: string;
  price_reference?: number;
  indicator_reference?: string;
  rationale: string;
}

export interface CourtroomCaseCreate {
  symbol: string;
  timeframe?: string;
  thesis: string;
  notes?: string;
  support_level?: number;
  resistance_level?: number;
  screenshot_data?: string;
}

export interface CourtroomCase {
  case_id: string;
  symbol: string;
  timeframe: string;
  user_thesis: string;
  user_notes?: string;
  detected_stance: ThesisStance;
  status: string;
  market_snapshot: {
    symbol?: string;
    timeframe?: string;
    price?: number;
    high_24h?: number;
    low_24h?: number;
    volume_24h?: number;
    quote_volume_24h?: number;
    source?: string;
    timestamp?: string;
    rsi_14?: number;
    macd_hist?: number;
    ema_12?: number;
    ema_26?: number;
    sma_20?: number;
    sma_50?: number;
    orderbook_imbalance?: number;
    [key: string]: any;
  };
  prosecution_arguments: CourtroomArgument[];
  defense_arguments: CourtroomArgument[];
  cross_examination: CrossExaminationRow[];
  verdict: VerdictType;
  verdict_rationale: string;
  invalidation_conditions: InvalidationCondition[];
  data_sources: string[];
  evidence_count: number;
  created_at: string;
}
