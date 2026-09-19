import React, { useEffect, useState, useCallback } from 'react';
import { intelligenceApi } from '../api';
import { MarketStateResult } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { RefreshCw, Layers, Activity, TrendingUp, ShieldAlert } from 'lucide-react';

export const Features: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [stateResult, setStateResult] = useState<MarketStateResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ghost-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-ghost-textPrimary uppercase">
              Quantitative Feature Engine
            </h1>
            <span className="px-2 py-0.5 rounded text-2xs font-mono bg-sky-500/10 text-sky-400 border border-sky-500/30">
              ZERO-LOOKAHEAD
            </span>
          </div>
          <p className="text-xs font-mono text-ghost-textMuted mt-0.5">
            Normalized point-in-time quantitative features strictly calculated on the backend
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <AssetSelector
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(s) => setSelectedSymbol(s)}
          />

          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-2.5 py-1.5 bg-ghost-card border border-ghost-border rounded-lg text-ghost-textPrimary focus:outline-none focus:border-ghost-cyan text-xs font-mono"
          >
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>

          <button
            onClick={fetchFeatures}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-borderLight text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Recalculate</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchFeatures} />}

      {/* Feature Groups */}
      {isLoading ? (
        <LoadingState message="Extracting trailing feature matrix from backend..." />
      ) : (
        <div className="space-y-6">
          {/* Section 1: Momentum & Velocity Indicators */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-ghost-cyan" />
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                1. Momentum & Velocity Oscillators
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="RSI (14-PERIOD)"
                value={features.rsi_14 !== undefined ? features.rsi_14.toFixed(2) : '—'}
                subValue={
                  features.rsi_14 !== undefined
                    ? features.rsi_14 >= 70
                      ? 'Overbought Zone'
                      : features.rsi_14 <= 30
                      ? 'Oversold Zone'
                      : 'Neutral Momentum'
                    : undefined
                }
                variant={features.rsi_14 >= 70 ? 'red' : features.rsi_14 <= 30 ? 'green' : 'default'}
              />
              <MetricCard
                label="MACD HISTOGRAM"
                value={features.macd_hist !== undefined ? features.macd_hist.toFixed(4) : '—'}
                subValue={features.macd !== undefined ? `MACD: ${features.macd.toFixed(3)} | Signal: ${features.macd_signal?.toFixed(3)}` : undefined}
                variant={features.macd_hist >= 0 ? 'green' : 'red'}
              />
              <MetricCard
                label="MOMENTUM (10-PERIOD)"
                value={features.momentum_10 !== undefined ? `${(features.momentum_10 * 100).toFixed(2)}%` : '—'}
                subValue="Trailing 10-candle velocity rate"
                variant="default"
              />
              <MetricCard
                label="TREND STRENGTH"
                value={features.trend_strength !== undefined ? `${(features.trend_strength * 100).toFixed(2)}%` : '—'}
                subValue="(SMA_fast - SMA_slow) / SMA_slow"
                variant="cyan"
              />
            </div>
          </div>

          {/* Section 2: Volatility & Price Dispersion */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-ghost-amber" />
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                2. Volatility & Dispersion Regimes
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="AVERAGE TRUE RANGE (14)"
                value={features.atr_14 !== undefined ? `$${features.atr_14.toFixed(2)}` : '—'}
                subValue="Trailing average candle range"
                variant="default"
              />
              <MetricCard
                label="BOLLINGER BANDWIDTH"
                value={features.bollinger_bandwidth !== undefined ? `${(features.bollinger_bandwidth * 100).toFixed(2)}%` : '—'}
                subValue="Band expansion / compression"
                variant="default"
              />
              <MetricCard
                label="REALIZED VOLATILITY (20)"
                value={features.volatility_20 !== undefined ? `${(features.volatility_20 * 100).toFixed(2)}%` : '—'}
                subValue="Rolling standard deviation"
                variant="amber"
              />
              <MetricCard
                label="LOGARITHMIC RETURN"
                value={features.log_returns !== undefined ? `${(features.log_returns * 100).toFixed(4)}%` : '—'}
                subValue={`Arithmetic: ${(features.returns ? features.returns * 100 : 0).toFixed(4)}%`}
                variant="default"
              />
            </div>
          </div>

          {/* Section 3: Trend & Capital Preservation */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-4 h-4 text-ghost-red" />
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                3. Trend Envelope & Capital Preservation
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="SMA (20-PERIOD)"
                value={features.sma_20 !== undefined ? `$${features.sma_20.toFixed(2)}` : '—'}
                subValue="Short-term moving average"
                variant="default"
              />
              <MetricCard
                label="EMA (20-PERIOD)"
                value={features.ema_20 !== undefined ? `$${features.ema_20.toFixed(2)}` : '—'}
                subValue="Exponential weighted mean"
                variant="default"
              />
              <MetricCard
                label="CURRENT DRAWDOWN"
                value={features.drawdown !== undefined ? `${(features.drawdown * 100).toFixed(2)}%` : '—'}
                subValue="Decline from recent peak"
                variant={features.drawdown < -0.10 ? 'red' : 'default'}
              />
              <MetricCard
                label="MAX CUMULATIVE DRAWDOWN"
                value={features.max_drawdown !== undefined ? `${(features.max_drawdown * 100).toFixed(2)}%` : '—'}
                subValue="Worst sample historical trough"
                variant="red"
              />
            </div>
          </div>

          {/* Section 4: Microstructure & Correlation */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-purple-400" />
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                4. Microstructure & Cross-Asset Correlation
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                label="ORDERBOOK IMBALANCE (OBI)"
                value={features.orderbook_imbalance !== undefined ? features.orderbook_imbalance.toFixed(4) : '—'}
                subValue={
                  features.orderbook_imbalance !== undefined
                    ? features.orderbook_imbalance > 0
                      ? 'Bid Pressure Dominant'
                      : 'Ask Pressure Dominant'
                    : undefined
                }
                variant={features.orderbook_imbalance > 0 ? 'green' : 'red'}
              />
              <MetricCard
                label="ROLLING CORRELATION"
                value={features.rolling_correlation !== undefined ? features.rolling_correlation.toFixed(3) : '—'}
                subValue="Trailing cross-correlation factor"
                variant="default"
              />
              <MetricCard
                label="FEATURE SPEC VERSION"
                value="v1.0"
                subValue="Strictly zero-lookahead"
                variant="cyan"
              />
              <MetricCard
                label="MODEL SPECIFICATION"
                value="GHOST-ENG"
                subValue={`Candles consumed: ${stateResult?.features_used ? 100 : 0}`}
                variant="default"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
