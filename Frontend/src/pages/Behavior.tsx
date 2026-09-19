import React, { useEffect, useState, useCallback } from 'react';
import { behaviorApi } from '../api';
import { BehaviorAnalysisResult } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { Activity, RefreshCw, Users, Eye, ChevronRight, AlertCircle, Shield } from 'lucide-react';

export const Behavior: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [behavior, setBehavior] = useState<BehaviorAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);
  const [showRawTelemetry, setShowRawTelemetry] = useState<boolean>(false);

  const fetchBehavior = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await behaviorApi.getAssetBehavior(selectedSymbol, timeframe, 100);
      setBehavior(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    fetchBehavior();
  }, [fetchBehavior]);

  const obi = behavior?.liquidity_pressure?.net_imbalance ?? 0;
  const spreadBps = behavior?.liquidity_pressure?.spread_bps ?? 0;
  const confidencePercent = behavior ? Math.round((behavior.confidence ?? 0) * 100) : 0;
  const behaviorStateText = behavior?.behavior_state ? behavior.behavior_state.replace(/_/g, ' ') : 'NEUTRAL';
  const primaryParticipantText = behavior?.primary_participant ? behavior.primary_participant.replace(/_/g, ' ') : 'MIXED';

  const participantBreakdown = behavior?.participant_breakdown ? Object.entries(behavior.participant_breakdown) : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div>
          <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            Market Activity
          </h1>
          <p className="text-sm text-ghost-textMuted mt-0.5">
            Microstructure order flow imbalance and participant footprints for {selectedSymbol}.
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
            onClick={fetchBehavior}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-cyan/50 text-xs font-medium text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Update</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchBehavior} />}

      {isLoading ? (
        <LoadingState message="Analyzing order book activity..." />
      ) : behavior ? (
        <div className="space-y-6">
          {/* Top Metric Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Activity State"
              value={behaviorStateText}
              badge={<RiskBadge label={behavior.behavior_state} size="sm" />}
              icon={<Activity className="w-4 h-4" />}
              variant="cyan"
            />

            <MetricCard
              label="Order Book Imbalance"
              value={`${(obi * 100).toFixed(1)}%`}
              subValue={obi > 0 ? 'Net Buyer Accumulation' : obi < 0 ? 'Net Seller Pressure' : 'Balanced Book'}
              variant={obi > 0 ? 'green' : obi < 0 ? 'red' : 'default'}
            />

            <MetricCard
              label="Bid-Ask Spread"
              value={`${spreadBps.toFixed(1)} bps`}
              subValue={`Resilience: ${behavior.liquidity_pressure.depth_resilience || 'NORMAL'}`}
            />

            <MetricCard
              label="Model Confidence"
              value={`${confidencePercent}%`}
              subValue={`Primary: ${primaryParticipantText}`}
            />
          </div>

          {/* Activity Summary Narrative */}
          {behavior.summary && (
            <div className="p-4 bg-ghost-card border border-ghost-border rounded-xl flex items-start gap-3">
              <Shield className="w-5 h-5 text-ghost-cyan shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-semibold text-ghost-textPrimary uppercase tracking-wider">
                  Microstructure Intelligence Synthesis
                </h3>
                <p className="text-sm text-ghost-textMuted mt-1 leading-relaxed">
                  {behavior.summary}
                </p>
              </div>
            </div>
          )}

          {/* Factual Microstructure Observations Card */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-ghost-cyan" />
                <h2 className="text-base font-semibold text-ghost-textPrimary">
                  Key Order Book Observations
                </h2>
              </div>
            </div>

            <div className="space-y-3">
              {behavior.observations && behavior.observations.length > 0 ? (
                behavior.observations.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg flex items-start justify-between gap-4 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-ghost-textPrimary">
                          {item.metric ? item.metric.replace(/_/g, ' ') : 'Observation'}
                        </span>
                        {item.source && (
                          <span className="font-mono text-[10px] px-1.5 py-0.2 bg-ghost-border/40 text-ghost-textMuted rounded uppercase">
                            {item.source}
                          </span>
                        )}
                      </div>
                      <p className="text-ghost-textMuted">{item.interpretation}</p>
                    </div>
                    <div className="text-right font-mono font-bold text-ghost-cyan shrink-0">
                      {typeof item.value === 'number' ? item.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : item.value}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-ghost-textMuted p-3 bg-ghost-darkest/40 rounded-lg border border-ghost-border/40">
                  No microstructure observations recorded.
                </p>
              )}
            </div>
          </div>

          {/* Whale & Large Holder Footprints */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h2 className="text-base font-semibold text-ghost-textPrimary">
                  Large Block & Liquidity Cluster Analysis
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans text-xs">
              <div className="p-4 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-1">
                <span className="text-ghost-textMuted text-[11px] block uppercase tracking-wider">Limit Wall Detected</span>
                <span className={`text-base font-bold ${behavior.whale_activity.wall_detected ? 'text-amber-400' : 'text-ghost-textPrimary'}`}>
                  {behavior.whale_activity.wall_detected ? `YES (${behavior.whale_activity.wall_side || 'BID/ASK'})` : 'NO WALLS DETECTED'}
                </span>
              </div>

              <div className="p-4 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-1">
                <span className="text-ghost-textMuted text-[11px] block uppercase tracking-wider">Depth Concentration Score</span>
                <span className="text-base font-bold text-ghost-textPrimary font-mono">
                  {(behavior.whale_activity.concentration_score * 100).toFixed(1)}%
                </span>
              </div>

              <div className="p-4 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-1">
                <span className="text-ghost-textMuted text-[11px] block uppercase tracking-wider">Absorption Ratio</span>
                <span className="text-base font-bold text-ghost-cyan font-mono">
                  {behavior.whale_activity.absorption_ratio.toFixed(2)}x
                </span>
              </div>
            </div>
          </div>

          {/* Participant Archetypes */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <h2 className="text-base font-semibold text-ghost-textPrimary">
                  Participant Archetypes Breakdown
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 font-sans text-xs">
              {participantBreakdown.map(([archetype, score]) => (
                <div key={archetype} className="p-4 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-2">
                  <span className="font-semibold text-ghost-textPrimary capitalize block">
                    {archetype.replace(/_/g, ' ')}
                  </span>
                  <div className="w-full bg-ghost-border/60 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-ghost-cyan h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.round(score * 100)}%` }}
                    />
                  </div>
                  <span className="text-ghost-textMuted font-mono text-[11px] block">
                    Probability: {Math.round(score * 100)}%
                  </span>
                </div>
              ))}
            </div>

            {/* Progressive Disclosure Action */}
            <div className="pt-3 border-t border-ghost-border/40 flex items-center justify-between">
              <button
                onClick={() => setShowRawTelemetry(!showRawTelemetry)}
                className="text-xs text-ghost-cyan hover:underline flex items-center gap-1 font-medium"
              >
                <span>{showRawTelemetry ? 'Hide raw data' : 'View raw microstructure observations'}</span>
                <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${showRawTelemetry ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {/* Raw Telemetry Drawer */}
            {showRawTelemetry && (
              <div className="p-4 bg-ghost-darkest rounded-lg border border-ghost-border/80 text-xs font-mono text-ghost-textMuted space-y-3">
                <p className="text-ghost-textPrimary font-semibold font-sans">Raw Microstructure Data Payload:</p>
                <pre className="text-[11px] text-ghost-cyan leading-relaxed overflow-x-auto p-2 bg-black/40 rounded border border-ghost-border/40">
                  {JSON.stringify(behavior, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
