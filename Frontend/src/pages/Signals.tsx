import React, { useEffect, useState, useCallback } from 'react';
import { signalsApi } from '../api';
import { AggregatedSignalResult, SignalHistoryItem } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { Zap, RefreshCw, Layers, ShieldCheck, History } from 'lucide-react';

export const Signals: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [signalResult, setSignalResult] = useState<AggregatedSignalResult | null>(null);
  const [history, setHistory] = useState<SignalHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  const fetchSignals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sigRes, histRes] = await Promise.all([
        signalsApi.getAssetSignal(selectedSymbol, timeframe, 100),
        signalsApi.getSignalHistory(selectedSymbol, 10).catch(() => ({ data: [] })),
      ]);
      setSignalResult(sigRes.data);
      setHistory(histRes.data || []);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ghost-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-ghost-textPrimary uppercase">
              Quantitative Signal Engine
            </h1>
            <span className="px-2 py-0.5 rounded text-2xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              PHASE 8 ENSEMBLE
            </span>
          </div>
          <p className="text-xs font-mono text-ghost-textMuted mt-0.5">
            Dynamic regime-conditioned consensus across 5 heterogeneous quantitative strategy algorithms
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
            onClick={fetchSignals}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-borderLight text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Generate Signal</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchSignals} />}

      {isLoading ? (
        <LoadingState message="Evaluating multi-strategy quantitative consensus..." />
      ) : signalResult ? (
        <div className="space-y-6">
          {/* Top Consensus Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="CONSENSUS DIRECTION"
              value={signalResult.direction}
              badge={<RiskBadge label={signalResult.direction} variant="signal" size="sm" />}
              icon={<Zap className="w-4 h-4" />}
              variant={signalResult.direction === 'LONG' ? 'green' : signalResult.direction === 'SHORT' ? 'red' : 'default'}
            />
            <MetricCard
              label="CONSENSUS CONFIDENCE"
              value={`${(signalResult.confidence * 100).toFixed(1)}%`}
              subValue={`Horizon: ${signalResult.time_horizon.replace('_', ' ')}`}
              variant="cyan"
            />
            <MetricCard
              label="SIGNAL STRENGTH"
              value={`${(signalResult.strength * 100).toFixed(1)}%`}
              subValue={`Agreement Ratio: ${(signalResult.consensus_metrics.agreement_ratio * 100).toFixed(0)}%`}
              variant="default"
            />
            <MetricCard
              label="DOMINATION GUARD"
              value={signalResult.consensus_metrics.domination_guard_applied ? 'ACTIVE (≤35%)' : 'CLEAR'}
              subValue={`Lead: ${signalResult.consensus_metrics.dominant_strategy || 'Balanced'}`}
              icon={<ShieldCheck className="w-4 h-4" />}
              variant="green"
            />
          </div>

          {/* Strategy Signals Breakdown (Explainability) */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-ghost-border/60">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-ghost-cyan" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                  Strategy Ensemble Explainability
                </h3>
              </div>
              <span className="text-2xs font-mono text-ghost-textMuted">
                {signalResult.strategy_signals.length} Models Contributing
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 font-mono text-xs">
              {signalResult.strategy_signals.map((strat, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-ghost-darkest border border-ghost-border/80 hover:border-ghost-borderLight transition-all shadow-md flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-ghost-textPrimary">{strat.strategy_name}</span>
                      <RiskBadge label={strat.direction} variant="signal" size="sm" />
                    </div>

                    <div className="flex justify-between text-2xs text-ghost-textMuted mb-2 pb-2 border-b border-ghost-border/40">
                      <span>Conf: {(strat.confidence * 100).toFixed(1)}%</span>
                      <span>Strength: {(strat.strength * 100).toFixed(1)}%</span>
                    </div>

                    <ul className="space-y-1 text-2xs text-slate-300">
                      {strat.reasons.map((r, ri) => (
                        <li key={ri} className="flex items-start gap-1.5">
                          <span className="text-ghost-cyan">•</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {strat.metrics && Object.keys(strat.metrics).length > 0 && (
                    <div className="mt-3 pt-2 border-t border-ghost-border/40 flex flex-wrap gap-2 text-2xs text-ghost-textMuted">
                      {Object.entries(strat.metrics).map(([k, v]) => (
                        <span key={k}>
                          {k}: <strong className="text-ghost-textPrimary">{typeof v === 'number' ? v.toFixed(2) : String(v)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Persisted Signal History */}
          {history.length > 0 && (
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-ghost-border/60">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-ghost-cyan" />
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                    Chronological Signal Audit Log ({selectedSymbol})
                  </h3>
                </div>
                <span className="text-2xs font-mono text-ghost-textMuted">Database Audit Records</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="border-b border-ghost-border text-2xs text-ghost-textMuted uppercase">
                    <tr>
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Direction</th>
                      <th className="py-2 px-3">Confidence</th>
                      <th className="py-2 px-3">Strength</th>
                      <th className="py-2 px-3">Horizon</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ghost-border/40">
                    {history.map((item) => (
                      <tr key={item.id} className="hover:bg-ghost-border/20 transition-colors">
                        <td className="py-2 px-3 text-ghost-textMuted text-2xs">
                          {new Date(item.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <RiskBadge label={item.direction} variant="signal" size="sm" />
                        </td>
                        <td className="py-2 px-3 text-ghost-textPrimary">{(item.confidence * 100).toFixed(1)}%</td>
                        <td className="py-2 px-3 text-ghost-textPrimary">{(item.strength * 100).toFixed(1)}%</td>
                        <td className="py-2 px-3 text-ghost-textMuted text-2xs">{item.time_horizon}</td>
                        <td className="py-2 px-3 text-ghost-cyan text-2xs font-bold">{item.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
