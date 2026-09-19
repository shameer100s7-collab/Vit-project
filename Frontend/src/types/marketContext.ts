export type EvidenceQuality = 'HIGH' | 'MODERATE' | 'LIMITED' | 'INSUFFICIENT';

export type MarketContextState =
  | 'TRENDING'
  | 'RANGING'
  | 'COMPRESSING'
  | 'EXPANDING'
  | 'TRANSITIONING'
  | 'REJECTING'
  | 'CONSOLIDATING'
  | 'MIXED / UNCLEAR';

export interface MarketStateContext {
  state: MarketContextState;
  summary: string;
}

export interface MarketMap {
  price: string;
  structure: string;
  time: string;
  volume: string;
  range: string;
  location: string;
  candle_behavior: string;
}

export interface ScreenshotQualityGateResult {
  quality_gate_passed: boolean;
  clarity_rating: EvidenceQuality;
  reasons: string[];
  candle_bodies_visible: boolean;
  wicks_visible: boolean;
  volume_visible: boolean;
  price_scale_visible: boolean;
  error_title?: string;
  error_message?: string;
}

export interface MultiTimeframeLevel {
  timeframe: string;
  structure_summary: string;
  context_role: string;
}

export interface TimeframeScreenshot {
  timeframe: string;
  image_data: string;
}

export interface MarketContextRequest {
  asset: string;
  timeframe: string;
  image_data: string;
  has_volume?: boolean;
  secondary_screenshots?: TimeframeScreenshot[];
}

export interface MarketContextResult {
  asset: string;
  timeframe: string;
  evidence_quality: EvidenceQuality;
  market_state: MarketStateContext;
  market_map: MarketMap;
  supporting_evidence: string[];
  conflicting_evidence: string[];
  current_context: string;
  what_to_watch: string[];
  limitations: string[];
  quality_gate: ScreenshotQualityGateResult;
  multi_timeframe_synthesis?: string;
  multi_timeframe_levels?: MultiTimeframeLevel[];
  live_market_comparison?: {
    live_price?: number;
    source?: string;
    timestamp?: string;
    note?: string;
  };
  timestamp: string;
}
