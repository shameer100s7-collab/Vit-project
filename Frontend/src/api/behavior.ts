import { api } from './client';
import { BehaviorAnalysisResult } from '../types';

export const behaviorApi = {
  /** GET /api/v1/behavior/{symbol} */
  getAssetBehavior: (symbol: string, timeframe: string = '1h', limit: number = 100) =>
    api.get<BehaviorAnalysisResult>(
      `/api/v1/behavior/${encodeURIComponent(symbol)}?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`
    ),
};
