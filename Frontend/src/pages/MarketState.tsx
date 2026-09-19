import React, { useEffect, useState, useCallback } from 'react';
import { intelligenceApi } from '../api';
import { MarketStateResult } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { Compass, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Info } from 'lucide-react';

export const MarketState: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [stateResult, setStateResult] = useState<MarketStateResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  const fetchState = useCallback(async () => {
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
    fetchState();
  }, [fetchState]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ghost-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-ghost-textPrimary uppercase">
              Macro Market Regime & Intelligence
            </h1>
            <span className="px-2 py-0.5 rounded text-2xs font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30">
              PHASE 7 ENGINE
            </span>
          </div>
          <p className="text-xs font-mono text-ghost-textMuted mt-0.5">
            Probabilistic regime classification with indicator evidence, conflict analysis, and bounded confidence
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
            onClick={fetchState}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-borderLight text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Classify</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchState} />}

      {isLoading ? (
        <LoadingState message="Executing regime classification and conflict analysis..." />
      ) : stateResult ? (
        <div className="space-y-6">
          {/* Regime Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="PRIMARY REGIME"
              value={stateResult.state.replace('_', ' ')}
              badge={<RiskBadge label={stateResult.state} variant="state" size="sm" />}
              icon={<Compass className="w-4 h-4" />}
              variant="cyan"
            />
            <MetricCard
              label="BOUNDED CONFIDENCE"
              value={`${(stateResult.confidence * 100).toFixed(1)}%`}
              subValue="Enforces bounds: [0.05, 0.95]"
              variant={stateResult.confidence >= 0.70 ? 'green' : stateResult.confidence >= 0.50 ? 'amber' : 'default'}
            />
            <MetricCard
              label="CONFLICT DETECTED"
              value={stateResult.conflict_detected ? 'YES' : 'NO'}
              subValue={stateResult.conflict_detected ? `${stateResult.conflict_reasons.length} conflicting indicator(s)` : 'Coherent market metrics'}
              variant={stateResult.conflict_detected ? 'red' : 'green'}
            />
            <MetricCard
              label="ENGINE METADATA"
              value={stateResult.model_version || 'v1.0.0'}
              subValue={`Evaluated: ${new Date(stateResult.timestamp).toLocaleTimeString()}`}
              variant="default"
            />
          </div>

          {/* Conflict Alert Box if present */}
          {stateResult.conflict_detected && stateResult.conflict_reasons.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs flex items-start gap-3 shadow-lg">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-bold uppercase tracking-wider block mb-1">
                  Cross-Indicator Conflict Warning
                </span>
                <ul className="list-disc list-inside space-y-1 text-2xs text-amber-200/90">
                  {stateResult.conflict_reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Supporting Evidence List */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-ghost-border/60">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-ghost-cyan" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                  Supporting Empirical Evidence
                </h3>
              </div>
              <span className="text-2xs font-mono text-ghost-textMuted">
                {stateResult.evidence.length} Indicators Evaluated
              </span>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              {stateResult.evidence.map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-ghost-darkest border border-ghost-border/60 hover:border-ghost-borderLight transition-colors gap-2"
                >
                  <div className="flex items-center gap-2.5">
                    {item.supports_state ? (
                      <CheckCircle2 className="w-4 h-4 text-ghost-green flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-ghost-red flex-shrink-0" />
                    )}
                    <div>
                      <span className="font-semibold text-ghost-textPrimary uppercase tracking-wide">
                        {item.indicator_name.replace('_', ' ')}
                      </span>
                      <p className="text-2xs text-ghost-textMuted mt-0.5">
                        {item.rationale}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right flex-shrink-0 self-end sm:self-auto text-2xs">
                    <div>
                      <span className="text-ghost-textMuted block">OBSERVED</span>
                      <span className="font-bold text-ghost-textPrimary">
                        {typeof item.observed_value === 'number' ? item.observed_value.toFixed(3) : item.observed_value}
                      </span>
                    </div>
                    <div>
                      <span className="text-ghost-textMuted block">THRESHOLD</span>
                      <span className="text-ghost-cyan font-bold">
                        {typeof item.threshold === 'number' ? item.threshold.toFixed(3) : item.threshold}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
