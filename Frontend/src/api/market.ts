import { api, formatSymbolForApi } from './client';
import {
  CanonicalAssetMetadata,
  CanonicalCandle,
  CanonicalMarketOverview,
  CanonicalOrderBook,
  CanonicalPrice,
  CanonicalVolume,
} from '../types';

export const marketApi = {
  /** Normalizes symbol representation (e.g. BTC/USDT to BTCUSDT) */
  normalizeSymbol: (symbol: string): string => formatSymbolForApi(symbol),

  /** GET /api/v1/market/overview */
  getOverview: () => api.get<CanonicalMarketOverview>('/api/v1/market/overview'),

  /** GET /api/v1/market/{symbol} */
  getPrice: (symbol: string) => api.get<CanonicalPrice>(`/api/v1/market/${encodeURIComponent(formatSymbolForApi(symbol))}`),

  /** GET /api/v1/market/{symbol}/ohlcv */
  getOhlcv: (symbol: string, timeframe: string = '1h', limit: number = 100) =>
    api.get<CanonicalCandle[]>(
      `/api/v1/market/${encodeURIComponent(formatSymbolForApi(symbol))}/ohlcv?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`
    ),

  /** GET /api/v1/market/{symbol}/orderbook */
  getOrderBook: (symbol: string, depth: number = 20) =>
    api.get<CanonicalOrderBook>(`/api/v1/market/${encodeURIComponent(formatSymbolForApi(symbol))}/orderbook?depth=${depth}`),

  /** GET /api/v1/market/{symbol}/volume */
  getVolume: (symbol: string) => api.get<CanonicalVolume>(`/api/v1/market/${encodeURIComponent(formatSymbolForApi(symbol))}/volume`),

  /** GET /api/v1/market/{symbol}/metadata */
  getMetadata: (symbol: string) =>
    api.get<CanonicalAssetMetadata>(`/api/v1/market/${encodeURIComponent(formatSymbolForApi(symbol))}/metadata`),

  /** GET /api/v1/market/provider/health */
  getProviderHealth: () => api.get<Record<string, any>>('/api/v1/market/provider/health'),
};
