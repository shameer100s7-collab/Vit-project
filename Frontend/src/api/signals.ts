import { api, formatSymbolForApi } from './client';
import {
  AggregatedSignalResult,
  SignalHistoryItem,
  MarketContextRequest,
  MarketContextResult,
  ScreenshotQualityGateResult,
} from '../types';

export const signalsApi = {
  /** POST /api/v1/signals/context/analyze */
  analyzeContext: (payload: MarketContextRequest) =>
    api.post<MarketContextResult>('/api/v1/signals/context/analyze', payload),

  /** POST /api/v1/signals/context/quality-check */
  checkQuality: (payload: MarketContextRequest) =>
    api.post<ScreenshotQualityGateResult>('/api/v1/signals/context/quality-check', payload),

  /** GET /api/v1/signals/{symbol} */
  getAssetSignal: (symbol: string, timeframe: string = '1h', limit: number = 100) =>
    api.get<AggregatedSignalResult>(
      `/api/v1/signals/${encodeURIComponent(formatSymbolForApi(symbol))}?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`
    ),

  /** GET /api/v1/signals/{symbol}/history */
  getSignalHistory: (symbol: string, limit: number = 50) =>
    api.get<SignalHistoryItem[]>(
      `/api/v1/signals/${encodeURIComponent(formatSymbolForApi(symbol))}/history?limit=${limit}`
    ),
};

