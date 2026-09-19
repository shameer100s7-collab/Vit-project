import React, { useEffect, useState, useCallback } from 'react';
import { riskApi } from '../api';
import { RiskHistoryItem } from '../types';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { History, RefreshCw, Database, ChevronDown, ChevronUp } from 'lucide-react';

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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div>
          <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            Risk Audit History
          </h1>
          <p className="text-sm text-ghost-textMuted mt-0.5">
            Chronological audit log of risk analyses persisted in the database for {selectedSymbol}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AssetSelector
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(s) => setSelectedSymbol(s)}
          />

          <button
            onClick={fetchHistory}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-sand/50 text-xs font-medium text-ghost-textPrimary hover:text-ghost-sand transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-sand' : ''}`} />
            <span>Query Audit Trail</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchHistory} />}

      {isLoading ? (
        <LoadingState message="Retrieving persisted risk history records..." />
      ) : history.length === 0 ? (
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-8 text-center font-sans text-xs text-ghost-textMuted space-y-2">
          <Database className="w-8 h-8 text-ghost-textDim mx-auto" />
          <p className="text-ghost-textPrimary font-semibold">No Historical Risk Records for {selectedSymbol}</p>
          <p className="text-ghost-textDim">Records are stored automatically whenever the Risk Assessment is run.</p>
        </div>
      ) : (
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4 font-sans text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-ghost-sand" />
              <h2 className="text-sm font-semibold text-ghost-textPrimary">
                Persisted Audit Records ({history.length} Entries)
              </h2>
            </div>
            <span className="text-ghost-textMuted font-mono text-2xs">
              Target Asset: {selectedSymbol}
            </span>
          </div>

          <div className="space-y-2">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-lg bg-ghost-darkest border border-ghost-border/60 overflow-hidden transition-colors"
              >
                <div
                  onClick={() => toggleExpand(item.id)}
                  className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:bg-ghost-border/30"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-ghost-textMuted font-mono text-2xs">{new Date(item.timestamp).toLocaleString()}</span>
                    <span className="font-mono font-bold text-ghost-textPrimary">{item.target_id}</span>
                    <RiskBadge
                      label={item.overall_risk > 0.6 ? 'HIGH' : item.overall_risk > 0.35 ? 'MODERATE' : 'LOW'}
                      size="sm"
                    />
                  </div>

                  <div className="flex items-center gap-4 text-2xs font-mono">
                    <div>
                      <span className="text-ghost-textMuted mr-1">Risk Score:</span>
                      <strong className="text-ghost-sand">{(item.overall_risk * 100).toFixed(1)}</strong>
                    </div>
                    <div>
                      <span className="text-ghost-textMuted mr-1">Vol:</span>
                      <strong className="text-ghost-textPrimary">{(item.volatility * 100).toFixed(1)}%</strong>
                    </div>
                    <div>
                      <span className="text-ghost-textMuted mr-1">1D VaR 95%:</span>
                      <strong className="text-rose-400">{item.var_95 ? `${(item.var_95 * 100).toFixed(2)}%` : '—'}</strong>
                    </div>
                    <div>
                      <span className="text-ghost-textMuted mr-1">Max DD:</span>
                      <strong className="text-amber-400">{item.max_drawdown ? `${(item.max_drawdown * 100).toFixed(1)}%` : '—'}</strong>
                    </div>

                    <div className="text-ghost-textMuted">
                      {expandedId === item.id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                </div>

                {expandedId === item.id && (
                  <div className="p-3 bg-ghost-darkest/90 border-t border-ghost-border/40 font-mono text-2xs text-ghost-textMuted space-y-2">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-ghost-textDim block">RECORD ID</span>
                        <span className="text-ghost-textPrimary">{item.id}</span>
                      </div>
                      <div>
                        <span className="text-ghost-textDim block">TARGET TYPE</span>
                        <span className="text-ghost-textPrimary">{item.target_type}</span>
                      </div>
                      <div>
                        <span className="text-ghost-textDim block">CALCULATED AT</span>
                        <span className="text-ghost-textPrimary">{item.timestamp}</span>
                      </div>
                      <div>
                        <span className="text-ghost-textDim block">STATUS</span>
                        <span className="text-emerald-400 font-semibold">Persisted SQL</span>
                      </div>
                    </div>
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
