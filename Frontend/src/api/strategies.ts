/**
 * Strategies REST API Client
 */

import { api } from './client';
import {
  StrategyItem,
  StrategyCreatePayload,
  BacktestResult,
  PaperTradingStatus,
  OnChainProof,
  StrategyVerificationResult,
} from '../types';

export const strategiesApi = {
  list: async () => {
    const res = await api.get<StrategyItem[]>('/api/v1/strategies');
    return res.data;
  },

  get: async (strategyId: string) => {
    const res = await api.get<StrategyItem>(`/api/v1/strategies/${strategyId}`);
    return res.data;
  },

  create: async (payload: StrategyCreatePayload) => {
    const res = await api.post<StrategyItem>('/api/v1/strategies', payload);
    return res.data;
  },

  runBacktest: async (
    strategyId: string,
    params?: {
      asset?: string;
      timeframe?: string;
      limit?: number;
      initial_capital?: number;
      fee_pct?: number;
      slippage_pct?: number;
    }
  ) => {
    const res = await api.post<BacktestResult>(
      `/api/v1/strategies/${strategyId}/backtest`,
      params || {}
    );
    return res.data;
  },

  getLatestBacktest: async (strategyId: string) => {
    const res = await api.get<BacktestResult>(`/api/v1/strategies/${strategyId}/backtest`);
    return res.data;
  },

  startPaperTrading: async (strategyId: string) => {
    const res = await api.post<PaperTradingStatus>(
      `/api/v1/strategies/${strategyId}/paper-trading/start`
    );
    return res.data;
  },

  stopPaperTrading: async (strategyId: string) => {
    const res = await api.post<PaperTradingStatus>(
      `/api/v1/strategies/${strategyId}/paper-trading/stop`
    );
    return res.data;
  },

  getPaperTradingStatus: async (strategyId: string) => {
    const res = await api.get<PaperTradingStatus>(
      `/api/v1/strategies/${strategyId}/paper-trading`
    );
    return res.data;
  },

  evaluatePaperTradingTick: async (strategyId: string) => {
    const res = await api.post<PaperTradingStatus>(
      `/api/v1/strategies/${strategyId}/paper-trading/tick`
    );
    return res.data;
  },

  registerOnChain: async (strategyId: string) => {
    const res = await api.post<OnChainProof>(
      `/api/v1/strategies/${strategyId}/register-onchain`
    );
    return res.data;
  },

  getOnChainProof: async (strategyId: string) => {
    const res = await api.get<OnChainProof>(`/api/v1/strategies/${strategyId}/onchain`);
    return res.data;
  },

  getVerification: async (strategyId: string) => {
    const res = await api.get<StrategyVerificationResult>(
      `/api/v1/strategies/${strategyId}/verification`
    );
    return res.data;
  },

  getProvenance: async (strategyId: string) => {
    const res = await api.get<Record<string, any>>(
      `/api/v1/strategies/${strategyId}/provenance`
    );
    return res.data;
  },
};
