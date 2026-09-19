import { api, formatSymbolForApi } from './client';
import {
  AssetRiskResult,
  PortfolioRiskRequest,
  PortfolioRiskResult,
  RiskHistoryItem,
} from '../types';

export const riskApi = {
  /** GET /api/v1/risk/{symbol} */
  getAssetRisk: (
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100,
    benchmark: string = 'BTC/USDT'
  ) =>
    api.get<AssetRiskResult>(
      `/api/v1/risk/${encodeURIComponent(formatSymbolForApi(symbol))}?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}&benchmark=${encodeURIComponent(formatSymbolForApi(benchmark))}`
    ),

  /** GET /api/v1/risk/{symbol}/history */
  getAssetRiskHistory: (symbol: string, limit: number = 50) =>
    api.get<RiskHistoryItem[]>(
      `/api/v1/risk/${encodeURIComponent(formatSymbolForApi(symbol))}/history?limit=${limit}`
    ),

  /** POST /api/v1/risk/portfolio */
  evaluatePortfolioRisk: (request: PortfolioRiskRequest) =>
    api.post<PortfolioRiskResult>('/api/v1/risk/portfolio', request),

  /** GET /api/v1/risk/portfolio/{portfolio_id} */
  evaluateStoredPortfolioRisk: (
    portfolioId: string,
    timeframe: string = '1h',
    limit: number = 100
  ) =>
    api.get<PortfolioRiskResult>(
      `/api/v1/risk/portfolio/${encodeURIComponent(portfolioId)}?timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`
    ),
};
