import React, { useEffect, useState, useCallback } from 'react';
import { signalsApi } from '../api';
import { AggregatedSignalResult, StrategySignal } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { Zap, RefreshCw, ShieldCheck, ChevronRight } from 'lucide-react';

export const Signals: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [signalResult, setSignalResult] = useState<AggregatedSignalResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

  const fetchSignals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await signalsApi.getAssetSignal(selectedSymbol, timeframe, 100);
      setSignalResult(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const agreementRatio = signalResult?.consensus_metrics.agreement_ratio ?? 0;
  const totalStrategies = signalResult?.consensus_metrics.strategies_evaluated ?? 5;
  const agreementCount = Math.round(agreementRatio * totalStrategies);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div>
          <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            Signals Engine
          </h1>
          <p className="text-sm text-ghost-textMuted mt-0.5">
            Strategy consensus evaluated across 5 quantitative trading algorithms for {selectedSymbol}.
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
            onClick={fetchSignals}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-cyan/50 text-xs font-medium text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Generate</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchSignals} />}

      {isLoading ? (
        <LoadingState message="Evaluating quantitative strategy consensus..." />
      ) : signalResult ? (
        <div className="space-y-6">
          {/* Summary Hero Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Overall Consensus Signal"
              value={signalResult.direction}
              badge={<RiskBadge label={signalResult.direction} size="sm" />}
              icon={<Zap className="w-4 h-4" />}
              variant={signalResult.direction === 'LONG' || signalResult.direction.includes('BULLISH') ? 'green' : 'red'}
            />

            <MetricCard
              label="Strategy Agreement"
              value={`${agreementCount} / ${totalStrategies}`}
              subValue={`${Math.round(agreementRatio * 100)}% agreement rate`}
              variant="cyan"
            />

            <MetricCard
              label="Signal Confidence"
              value={`${Math.round(signalResult.confidence * 100)}%`}
              subValue={`Time Horizon: ${signalResult.time_horizon.replace('_', ' ')}`}
            />

            <MetricCard
              label="Domination Guard"
              value={signalResult.consensus_metrics.domination_guard_applied ? 'Triggered' : 'Normal'}
              subValue={signalResult.consensus_metrics.domination_guard_applied ? 'Single strategy capped' : 'No single strategy dominance'}
              variant={signalResult.consensus_metrics.domination_guard_applied ? 'amber' : 'default'}
              icon={<ShieldCheck className="w-4 h-4" />}
            />
          </div>

          {/* Strategy Decomposition List */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <h2 className="text-base font-semibold text-ghost-textPrimary">
                Individual Strategy Engines
              </h2>
              <span className="text-xs text-ghost-textMuted font-mono">{signalResult.strategy_signals.length} Engines Active</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {signalResult.strategy_signals.map((strat: StrategySignal) => (
                <div
                  key={strat.strategy_name}
                  className="p-4 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-ghost-textPrimary capitalize">
                      {strat.strategy_name.replace('_', ' ')}
                    </span>
                    <p className="text-xs text-ghost-textDim">
                      Confidence: {Math.round(strat.confidence * 100)}%
                    </p>
                  </div>

                  <RiskBadge label={strat.direction} size="md" />
                </div>
              ))}
            </div>

            {/* Progressive Disclosure Action */}
            <div className="pt-3 border-t border-ghost-border/40 flex items-center justify-between">
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-xs text-ghost-cyan hover:underline flex items-center gap-1 font-medium"
              >
                <span>{showTechnicalDetails ? 'Hide technical parameters' : 'View strategy weights & mathematical formulas'}</span>
                <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${showTechnicalDetails ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {/* Advanced Strategy Formula Drawer */}
            {showTechnicalDetails && (
              <div className="p-4 bg-ghost-darkest rounded-lg border border-ghost-border/80 text-xs font-mono space-y-3">
                <p className="text-ghost-textPrimary font-semibold font-sans">Ensemble Aggregation Specification:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-ghost-textMuted">
                  <div>
                    <span className="block text-[10px] text-ghost-textDim">AGGREGATOR MODEL</span>
                    <strong className="text-ghost-textPrimary">RegimeConditionedWeightedSum</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-ghost-textDim">DOMINANT STRATEGY</span>
                    <strong className="text-ghost-cyan">{signalResult.consensus_metrics.dominant_strategy}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-ghost-textDim">MARKET REGIME</span>
                    <strong className="text-ghost-textPrimary">{signalResult.market_state}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
