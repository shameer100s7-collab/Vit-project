import React, { useEffect, useState, useCallback } from 'react';
import { behaviorApi } from '../api';
import { BehaviorAnalysisResult } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { Activity, RefreshCw, Shield, Users, Eye } from 'lucide-react';

export const Behavior: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [behavior, setBehavior] = useState<BehaviorAnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ghost-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-ghost-textPrimary uppercase">
              Observable-Behavior & Game-Theoretic Model
            </h1>
            <span className="px-2 py-0.5 rounded text-2xs font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              PHASE 9 ENGINE
            </span>
          </div>
          <p className="text-xs font-mono text-ghost-textMuted mt-0.5">
            Decouples factual microstructure observations from probabilistic market participant inferences
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
            onClick={fetchBehavior}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-borderLight text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Analyze Telemetry</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchBehavior} />}

      {isLoading ? (
        <LoadingState message="Analyzing order book liquidity pressure and participant archetypes..." />
      ) : behavior ? (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="BEHAVIORAL STATE"
              value={behavior.primary_behavior_state.replace('_', ' ')}
              badge={<RiskBadge label={behavior.primary_behavior_state} variant="state" size="sm" />}
              icon={<Activity className="w-4 h-4" />}
              variant="cyan"
            />
            <MetricCard
              label="STATE CONFIDENCE"
              value={`${(behavior.state_confidence * 100).toFixed(1)}%`}
              subValue="Bounded mathematically: [0.05, 0.95]"
              variant="default"
            />
            <MetricCard
              label="DEPTH ASYMMETRY"
              value={`${behavior.liquidity_pressure.depth_asymmetry > 0 ? '+' : ''}${behavior.liquidity_pressure.depth_asymmetry.toFixed(3)}`}
              subValue={`Imbalance: ${behavior.liquidity_pressure.net_imbalance.toFixed(2)} units`}
              variant={behavior.liquidity_pressure.depth_asymmetry > 0 ? 'green' : 'red'}
            />
            <MetricCard
              label="RESTING WALLS"
              value={behavior.whale_activity.large_resting_walls_count}
              subValue={`Absorption Ratio: ${behavior.whale_activity.absorption_ratio.toFixed(2)}x`}
              variant={behavior.whale_activity.large_resting_walls_count > 0 ? 'amber' : 'default'}
            />
          </div>

          {/* Game-Theoretic Summary Alert Box */}
          <div className="p-4 rounded-xl bg-ghost-card border border-ghost-cyan/40 text-ghost-textPrimary font-mono text-xs shadow-lg">
            <div className="flex items-center gap-2 text-ghost-cyan font-bold uppercase tracking-wider mb-1.5">
              <Shield className="w-4 h-4" />
              <span>Objective Game-Theoretic Synthesis</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-xs">
              {behavior.game_theoretic_summary}
            </p>
            <div className="mt-2.5 pt-2 border-t border-ghost-border/40 flex items-center justify-between text-2xs text-ghost-textMuted">
              <span>REGIME CONTEXT: <strong className="text-ghost-textPrimary">{behavior.regime_context}</strong></span>
              <span>EPISTEMIC BOUND: Zero Mind-Reading / Observable Facts Only</span>
            </div>
          </div>

          {/* Main 2-column: Factual Observations vs Probabilistic Archetype Inferences */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Factual Microstructure Observations */}
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-ghost-border/60">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-ghost-cyan" />
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                    Factual Microstructure Observations
                  </h3>
                </div>
                <span className="text-2xs font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  FACTUAL ONLY
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {behavior.observations.map((obs, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-ghost-darkest border border-ghost-border/60 flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-ghost-textPrimary uppercase tracking-wide">
                        {obs.metric.replace(/_/g, ' ')}
                      </div>
                      <div className="text-2xs text-ghost-textMuted mt-0.5">{obs.context}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-ghost-cyan text-sm">{obs.observed_value}</div>
                      <div className="text-2xs text-ghost-textMuted">{obs.unit}</div>
                    </div>
                  </div>
                ))}

                {behavior.whale_activity.detected_walls.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-ghost-border/60">
                    <span className="text-2xs font-bold text-ghost-amber uppercase tracking-wider block mb-2">
                      Detected Resting Limit Walls (≥3.0x Average Depth)
                    </span>
                    <div className="space-y-1 text-2xs">
                      {behavior.whale_activity.detected_walls.map((wall, wi) => (
                        <div key={wi} className="flex justify-between items-center py-1 px-2 rounded bg-ghost-border/30">
                          <span className={wall.side === 'bid' ? 'text-ghost-green font-bold uppercase' : 'text-ghost-red font-bold uppercase'}>
                            {wall.side} @ ${wall.price.toLocaleString()}
                          </span>
                          <span className="text-ghost-textPrimary">
                            {wall.size.toFixed(2)} units ({wall.ratio_to_avg.toFixed(1)}x avg)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Column 2: Probabilistic Participant Archetypes */}
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-ghost-border/60">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                    Probabilistic Participant Archetypes
                  </h3>
                </div>
                <span className="text-2xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                  HYPOTHESIS MODEL
                </span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {behavior.participant_inferences.map((archetype, ai) => (
                  <div key={ai} className="p-3 rounded-lg bg-ghost-darkest border border-ghost-border/60">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="font-bold text-ghost-textPrimary">
                        {archetype.archetype.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-2xs px-1.5 py-0.5 rounded bg-ghost-border text-ghost-textMuted">
                          {archetype.activity_level}
                        </span>
                        <span className="font-bold text-ghost-cyan">
                          {(archetype.dominance_score * 100).toFixed(0)}% Dominance
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-ghost-border/40 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full bg-ghost-cyan rounded-full transition-all duration-500"
                        style={{ width: `${Math.round(archetype.dominance_score * 100)}%` }}
                      />
                    </div>

                    <ul className="space-y-0.5 text-2xs text-ghost-textMuted">
                      {archetype.observed_patterns.map((pat, pi) => (
                        <li key={pi} className="flex items-start gap-1">
                          <span className="text-ghost-cyan">•</span>
                          <span>{pat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
