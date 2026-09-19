import React, { useEffect, useState, useCallback } from 'react';
import { behaviorApi } from '../api';
import { BehaviorAnalysisResult, ParticipantActivity } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { Activity, RefreshCw, Users, Eye, ChevronRight } from 'lucide-react';

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

  const obi = behavior ? behavior.liquidity_pressure.net_imbalance : 0;
  const detectedWalls = behavior ? behavior.whale_activity.detected_walls : [];
  const bidWalls = detectedWalls.filter((w) => w.side.toLowerCase() === 'bid' || w.side.toLowerCase() === 'buy');
  const askWalls = detectedWalls.filter((w) => w.side.toLowerCase() === 'ask' || w.side.toLowerCase() === 'sell');

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div>
          <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            Market Activity
          </h1>
          <p className="text-sm text-ghost-textMuted mt-0.5">
            Order book microstructure observations and participant activity for {selectedSymbol}.
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
              value={behavior.primary_behavior_state.replace('_', ' ')}
              badge={<RiskBadge label={behavior.primary_behavior_state} size="sm" />}
              icon={<Activity className="w-4 h-4" />}
              variant="cyan"
            />

            <MetricCard
              label="Order Book Imbalance"
              value={`${(obi * 100).toFixed(1)}%`}
              subValue={obi > 0 ? 'Net Bid Accumulation' : 'Net Ask Pressure'}
              variant={obi > 0 ? 'green' : 'red'}
            />

            <MetricCard
              label="Resting Wall Barriers"
              value={`${bidWalls.length} Bids / ${askWalls.length} Asks`}
              subValue="Significant liquidity concentrations"
            />

            <MetricCard
              label="Confidence"
              value={`${Math.round(behavior.state_confidence * 100)}%`}
              subValue="Evaluated over 100 candles"
            />
          </div>

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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bid Walls */}
              <div className="p-4 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-2">
                <h3 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Support Bids ({bidWalls.length} Walls Detected)
                </h3>
                {bidWalls.length > 0 ? (
                  <div className="space-y-1.5 font-mono text-xs">
                    {bidWalls.map((wall, i: number) => (
                      <div key={i} className="flex justify-between items-center text-ghost-textPrimary">
                        <span>Price: ${wall.price.toFixed(2)}</span>
                        <span className="text-emerald-400 font-bold">{wall.size.toFixed(2)} BTC</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ghost-textMuted">No major support bid walls detected in current depth.</p>
                )}
              </div>

              {/* Ask Walls */}
              <div className="p-4 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-2">
                <h3 className="text-xs font-semibold text-rose-400 uppercase tracking-wider">
                  Resistance Asks ({askWalls.length} Walls Detected)
                </h3>
                {askWalls.length > 0 ? (
                  <div className="space-y-1.5 font-mono text-xs">
                    {askWalls.map((wall, i: number) => (
                      <div key={i} className="flex justify-between items-center text-ghost-textPrimary">
                        <span>Price: ${wall.price.toFixed(2)}</span>
                        <span className="text-rose-400 font-bold">{wall.size.toFixed(2)} BTC</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-ghost-textMuted">No major resistance ask walls detected in current depth.</p>
                )}
              </div>
            </div>
          </div>

          {/* Participant Archetypes */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <h2 className="text-base font-semibold text-ghost-textPrimary">
                  Participant Archetypes
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans text-xs">
              {behavior.participant_inferences.map((item: ParticipantActivity) => (
                <div key={item.archetype} className="p-4 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-2">
                  <span className="font-semibold text-ghost-textPrimary capitalize">
                    {item.archetype.replace('_', ' ')}
                  </span>
                  <div className="w-full bg-ghost-border/60 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-ghost-cyan h-full rounded-full"
                      style={{ width: `${Math.round(item.dominance_score * 100)}%` }}
                    />
                  </div>
                  <span className="text-ghost-textMuted font-mono text-2xs block">
                    Dominance: {Math.round(item.dominance_score * 100)}% ({item.activity_level})
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
                <p className="text-ghost-textPrimary font-semibold font-sans">Raw Observations Array:</p>
                <pre className="text-2xs text-ghost-cyan leading-relaxed overflow-x-auto">
                  {JSON.stringify(behavior.observations, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
