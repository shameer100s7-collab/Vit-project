import React, { useEffect, useState, useCallback } from 'react';
import { intelligenceApi } from '../api';
import { MarketStateResult } from '../types';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { RefreshCw, AlertTriangle, CheckCircle2, ChevronRight, Info } from 'lucide-react';

export const MarketState: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [stateResult, setStateResult] = useState<MarketStateResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);
  const [showAdvancedModel, setShowAdvancedModel] = useState<boolean>(false);

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

  const confidencePercent = stateResult ? Math.round(stateResult.confidence * 100) : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div>
          <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            Market Outlook
          </h1>
          <p className="text-sm text-ghost-textMuted mt-0.5">
            Current market momentum, volatility, and trend analysis for {selectedSymbol}.
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
            onClick={fetchState}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-cyan/50 text-xs font-medium text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Update</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchState} />}

      {isLoading ? (
        <LoadingState message="Evaluating market outlook..." />
      ) : stateResult ? (
        <div className="space-y-6">
          {/* Main Outlook Overview Hero Card */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-ghost-border/50">
              <div>
                <span className="text-xs text-ghost-textMuted font-medium">Current Market Outlook</span>
                <div className="flex items-center gap-3 mt-1">
                  <h2 className="text-2xl font-bold text-ghost-textPrimary">
                    {stateResult.state === 'BULLISH_TREND' ? 'Positive momentum' :
                     stateResult.state === 'BEARISH_TREND' ? 'Negative momentum' :
                     stateResult.state === 'SIDEWAYS' ? 'Consolidation' :
                     stateResult.state === 'HIGH_VOLATILITY' ? 'High volatility' :
                     stateResult.state.replace('_', ' ')}
                  </h2>
                  <RiskBadge label={stateResult.state} size="lg" />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <span className="text-xs text-ghost-textMuted block">Model Confidence</span>
                  <span className="text-xl font-mono font-bold text-ghost-cyan">{confidencePercent}%</span>
                </div>
                <div>
                  <span className="text-xs text-ghost-textMuted block">Timeframe</span>
                  <span className="text-sm font-medium text-ghost-textPrimary">{timeframe}</span>
                </div>
              </div>
            </div>

            {/* Supporting Factors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Supporting Factors */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-ghost-textMuted uppercase tracking-wider">
                  Supporting Factors
                </h3>
                <div className="space-y-2">
                  {stateResult.evidence?.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg flex items-center gap-3 text-xs text-ghost-textPrimary"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{item.rationale || `${item.indicator_name}: ${item.observed_value}`}</span>
                    </div>
                  )) || (
                    <p className="text-xs text-ghost-textMuted">No evidence recorded.</p>
                  )}
                </div>
              </div>

              {/* Conflict Analysis (if any) */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-ghost-textMuted uppercase tracking-wider">
                  Contradictory / Conflict Observations
                </h3>
                {stateResult.conflict_detected && stateResult.conflict_reasons?.length > 0 ? (
                  <div className="space-y-2">
                    {stateResult.conflict_reasons.map((reason, idx) => (
                      <div
                        key={idx}
                        className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg flex items-center gap-3 text-xs text-amber-300"
                      >
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-ghost-darkest/40 border border-ghost-border/40 rounded-lg text-xs text-ghost-textMuted flex items-center gap-2">
                    <Info className="w-4 h-4 text-ghost-cyan" />
                    <span>No contradicting indicator signals detected. Alignment is high.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Progressive Disclosure Action */}
            <div className="pt-4 border-t border-ghost-border/40 flex items-center justify-between">
              <button
                onClick={() => setShowAdvancedModel(!showAdvancedModel)}
                className="text-xs text-ghost-cyan hover:underline flex items-center gap-1.5 font-medium"
              >
                <span>{showAdvancedModel ? 'Hide advanced model details' : 'View model specification & parameters'}</span>
                <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${showAdvancedModel ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {/* Advanced Model Drawer */}
            {showAdvancedModel && (
              <div className="p-4 bg-ghost-darkest rounded-lg border border-ghost-border/80 text-xs font-mono space-y-3">
                <p className="text-ghost-textPrimary font-semibold font-sans">Quantitative Model Parameters:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-ghost-textMuted">
                  <div>
                    <span className="block text-[10px] text-ghost-textDim">MODEL VERSION</span>
                    <strong className="text-ghost-textPrimary">{stateResult.model_version}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-ghost-textDim">TOTAL SAMPLES</span>
                    <strong className="text-ghost-textPrimary">100 candles</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-ghost-textDim">CONFLICT DETECTED</span>
                    <strong className={stateResult.conflict_detected ? 'text-amber-400' : 'text-emerald-400'}>
                      {stateResult.conflict_detected ? 'Yes' : 'No'}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-ghost-textDim">EVALUATED AT</span>
                    <strong className="text-ghost-textPrimary">{new Date(stateResult.timestamp).toLocaleTimeString()}</strong>
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
