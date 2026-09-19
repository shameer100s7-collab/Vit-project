import React, { useEffect, useState, useCallback } from 'react';
import { intelligenceApi } from '../api';
import { MarketStateResult } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { RefreshCw, Activity, BarChart2, ShieldCheck, ChevronRight } from 'lucide-react';

export const Features: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [stateResult, setStateResult] = useState<MarketStateResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  const fetchFeatures = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await intelligenceApi.getMarketState(selectedSymbol, timeframe, 100);
      setStateResult(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const features = stateResult?.features_used || {};

  const rsi = features.rsi_14 !== undefined ? features.rsi_14 : 50;
  const macd = features.macd_hist !== undefined ? features.macd_hist : 0;
  const atr = features.atr_14 !== undefined ? features.atr_14 : 0;
  const bbBandwidth = features.bb_bandwidth !== undefined ? features.bb_bandwidth : 0;
  const obi = features.order_book_imbalance !== undefined ? features.order_book_imbalance : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div>
          <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            Market Analysis
          </h1>
          <p className="text-sm text-ghost-textMuted mt-0.5">
            Technical indicators and market momentum factors for {selectedSymbol}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AssetSelector
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(s) => setSelectedSymbol(s)}
          />

          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg text-ghost-textPrimary text-xs font-mono focus:outline-none focus:border-ghost-cyan"
          >
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>

          <button
            onClick={fetchFeatures}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-cyan/50 text-xs font-medium text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Update</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchFeatures} />}

      {isLoading ? (
        <LoadingState message="Calculating market indicators..." />
      ) : (
        <div className="space-y-6">
          {/* Section 1: Momentum */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-ghost-textPrimary flex items-center gap-2">
              <Activity className="w-4 h-4 text-ghost-cyan" />
              <span>Momentum Indicators</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                label="Relative Strength Index (RSI)"
                value={rsi.toFixed(1)}
                subValue={rsi > 70 ? 'Overbought' : rsi < 30 ? 'Oversold' : 'Neutral Momentum'}
                variant={rsi > 70 ? 'red' : rsi < 30 ? 'green' : 'default'}
              />

              <MetricCard
                label="MACD Histogram"
                value={macd.toFixed(2)}
                subValue={macd > 0 ? 'Bullish Crossover' : 'Bearish Divergence'}
                variant={macd > 0 ? 'green' : 'red'}
              />

              <MetricCard
                label="Order Book Imbalance"
                value={`${(obi * 100).toFixed(1)}%`}
                subValue={obi > 0 ? 'Net Bid Pressure' : 'Net Ask Pressure'}
                variant={obi > 0 ? 'green' : 'red'}
              />
            </div>
          </div>

          {/* Section 2: Volatility & Dispersion */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-ghost-textPrimary flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-purple-400" />
              <span>Volatility & Volatility Bands</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard
                label="Average True Range (ATR 14)"
                value={`$${atr.toFixed(2)}`}
                subValue="14-period price dispersion"
              />

              <MetricCard
                label="Bollinger Bandwidth"
                value={`${(bbBandwidth * 100).toFixed(2)}%`}
                subValue={bbBandwidth > 0.05 ? 'High Volatility Squeeze' : 'Normal Volatility'}
                variant="amber"
              />

              <MetricCard
                label="Market Regime Outlook"
                value={stateResult?.state.replace('_', ' ') || 'Neutral'}
                subValue={stateResult ? `Confidence: ${Math.round(stateResult.confidence * 100)}%` : undefined}
                variant="cyan"
              />
            </div>
          </div>

          {/* Progressive Disclosure: Technical Formulas */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-ghost-cyan" />
                <h3 className="text-sm font-semibold text-ghost-textPrimary">Technical Specification</h3>
              </div>

              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-xs text-ghost-cyan hover:underline flex items-center gap-1 font-medium"
              >
                <span>{showTechnicalDetails ? 'Hide calculation details' : 'View raw feature matrix'}</span>
                <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${showTechnicalDetails ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {showTechnicalDetails && (
              <div className="p-4 bg-ghost-darkest rounded-lg border border-ghost-border/80 font-mono text-xs text-ghost-textMuted space-y-3">
                <p className="text-ghost-textPrimary font-semibold">Raw Technical Feature Dictionary:</p>
                <pre className="text-2xs text-ghost-cyan leading-relaxed overflow-x-auto">
                  {JSON.stringify(features, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
