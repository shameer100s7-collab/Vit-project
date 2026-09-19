import { api } from './client';
import { AggregatedSignalResult, SignalHistoryItem } from '../types';

export const signalsApi = {
  /** GET /api/v1/signals/{symbol} */
  getAssetSignal: (symbol: string, timeframe: string = '1h', limit: number = 100) =>
    api.get<AggregatedSignalResult>(
      `/api/v1/signals/${encodeURIComponent(symbol)}?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`
    ),

  /** GET /api/v1/signals/{symbol}/history */
  getSignalHistory: (symbol: string, limit: number = 50) =>
    api.get<SignalHistoryItem[]>(
      `/api/v1/signals/${encodeURIComponent(symbol)}/history?limit=${limit}`
    ),
};
