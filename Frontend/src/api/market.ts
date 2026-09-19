import { api } from './client';
import {
  CanonicalAssetMetadata,
  CanonicalCandle,
  CanonicalMarketOverview,
  CanonicalOrderBook,
  CanonicalPrice,
  CanonicalVolume,
} from '../types';

export const marketApi = {
  /** Normalizes symbol representation (e.g. BTC/USDT to BTC-USDT) */
  normalizeSymbol: (symbol: string): string => symbol.replace('/', '-'),

  /** GET /api/v1/market/overview */
  getOverview: () => api.get<CanonicalMarketOverview>('/api/v1/market/overview'),

  /** GET /api/v1/market/{symbol} */
  getPrice: (symbol: string) => api.get<CanonicalPrice>(`/api/v1/market/${encodeURIComponent(symbol)}`),

  /** GET /api/v1/market/{symbol}/ohlcv */
  getOhlcv: (symbol: string, timeframe: string = '1h', limit: number = 100) =>
    api.get<CanonicalCandle[]>(
      `/api/v1/market/${encodeURIComponent(symbol)}/ohlcv?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`
    ),

  /** GET /api/v1/market/{symbol}/orderbook */
  getOrderBook: (symbol: string, depth: number = 20) =>
    api.get<CanonicalOrderBook>(`/api/v1/market/${encodeURIComponent(symbol)}/orderbook?depth=${depth}`),

  /** GET /api/v1/market/{symbol}/volume */
  getVolume: (symbol: string) => api.get<CanonicalVolume>(`/api/v1/market/${encodeURIComponent(symbol)}/volume`),

  /** GET /api/v1/market/{symbol}/metadata */
  getMetadata: (symbol: string) =>
    api.get<CanonicalAssetMetadata>(`/api/v1/market/${encodeURIComponent(symbol)}/metadata`),

  /** GET /api/v1/market/provider/health */
  getProviderHealth: () => api.get<Record<string, any>>('/api/v1/market/provider/health'),
};
