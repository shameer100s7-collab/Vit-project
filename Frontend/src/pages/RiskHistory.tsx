import React, { useEffect, useState, useCallback } from 'react';
import { riskApi } from '../api';
import { RiskHistoryItem } from '../types';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { History, RefreshCw, Database, Terminal, ChevronDown, ChevronUp } from 'lucide-react';

export const RiskHistory: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [history, setHistory] = useState<RiskHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await riskApi.getAssetRiskHistory(selectedSymbol, 50);
      setHistory(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ghost-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-ghost-textPrimary uppercase">
              Quantitative Risk Audit History
            </h1>
            <span className="px-2 py-0.5 rounded text-2xs font-mono bg-ghost-cyan/10 text-ghost-cyan border border-ghost-cyan/30">
              POSTGRES PERSISTENCE
            </span>
          </div>
          <p className="text-xs font-mono text-ghost-textMuted mt-0.5">
            Immutable chronological audit log of evaluated risk records from the risk_analyses table
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <AssetSelector
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(s) => setSelectedSymbol(s)}
          />

          <button
            onClick={fetchHistory}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-borderLight text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Query Log</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchHistory} />}

      {isLoading ? (
        <LoadingState message="Retrieving persisted risk evaluations from database..." />
      ) : history.length === 0 ? (
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-8 text-center font-mono text-xs text-ghost-textMuted">
          <Database className="w-8 h-8 text-ghost-textMuted mx-auto mb-2" />
          <p className="text-ghost-textPrimary font-semibold mb-1">No Historical Risk Records for {selectedSymbol}</p>
          <p className="text-2xs">Evaluations are persisted automatically when querying the Risk Engine.</p>
        </div>
      ) : (
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-ghost-border/60">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-ghost-cyan" />
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                Persisted Risk Analyses ({history.length} Entries)
              </h2>
            </div>
            <span className="text-2xs font-mono text-ghost-textMuted">
              Target: {selectedSymbol}
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-lg bg-ghost-darkest border border-ghost-border/80 overflow-hidden transition-colors"
              >
                <div
                  onClick={() => toggleExpand(item.id)}
                  className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-ghost-border/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xs text-ghost-textMuted">{new Date(item.timestamp).toLocaleString()}</span>
                    <span className="font-bold text-ghost-textPrimary">{item.target_id}</span>
                    <span className="px-1.5 py-0.5 rounded text-2xs bg-ghost-border text-ghost-textMuted">
                      {item.target_type}
                    </span>
                    <RiskBadge
                      label={item.overall_risk > 0.6 ? 'HIGH' : item.overall_risk > 0.35 ? 'MODERATE' : 'LOW'}
                      size="sm"
                    />
                  </div>

                  <div className="flex items-center gap-4 text-2xs">
                    <div>
                      <span className="text-ghost-textMuted mr-1">Risk Score:</span>
                      <strong className="text-ghost-cyan">{(item.overall_risk * 100).toFixed(1)}</strong>
                    </div>
                    <div>
                      <span className="text-ghost-textMuted mr-1">Vol:</span>
                      <strong className="text-ghost-textPrimary">{(item.volatility * 100).toFixed(1)}%</strong>
                    </div>
                    <div>
                      <span className="text-ghost-textMuted mr-1">1D VaR 95%:</span>
                      <strong className="text-ghost-textPrimary">{item.var_95 ? `${(item.var_95 * 100).toFixed(2)}%` : '—'}</strong>
                    </div>
                    <div>
                      <span className="text-ghost-textMuted mr-1">Max DD:</span>
                      <strong className="text-ghost-red">{item.max_drawdown ? `${(item.max_drawdown * 100).toFixed(1)}%` : '—'}</strong>
                    </div>

                    <div className="text-ghost-textMuted">
                      {expandedId === item.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>

                {expandedId === item.id && (
                  <div className="p-4 border-t border-ghost-border/60 bg-black/40 space-y-3 text-2xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-ghost-textMuted">
                      <div>ID: <strong className="text-ghost-textPrimary">{item.id}</strong></div>
                      <div>SHARPE: <strong className="text-ghost-green">{item.sharpe_ratio?.toFixed(2) || '—'}</strong></div>
                      <div>SORTINO: <strong className="text-ghost-green">{item.sortino_ratio?.toFixed(2) || '—'}</strong></div>
                      <div>BETA: <strong className="text-ghost-textPrimary">{item.beta?.toFixed(2) || '—'}</strong></div>
                    </div>

                    {item.metrics_payload && Object.keys(item.metrics_payload).length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center gap-1.5 text-ghost-cyan font-bold mb-1">
                          <Terminal className="w-3 h-3" />
                          <span>Persisted JSON Payload:</span>
                        </div>
                        <pre className="p-2.5 rounded bg-ghost-darkest border border-ghost-border/60 text-slate-300 overflow-x-auto text-2xs">
                          {JSON.stringify(item.metrics_payload, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
