import { api } from './client';
import { MarketStateResult } from '../types';

export const intelligenceApi = {
  /** GET /api/v1/intelligence/{symbol}/state */
  getMarketState: (symbol: string, timeframe: string = '1h', limit: number = 100) =>
    api.get<MarketStateResult>(
      `/api/v1/intelligence/${encodeURIComponent(symbol)}/state?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`
    ),
};
