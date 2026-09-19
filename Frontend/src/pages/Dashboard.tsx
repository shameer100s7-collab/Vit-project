import React, { useEffect, useState, useCallback } from 'react';
import { marketApi, intelligenceApi, signalsApi, behaviorApi, riskApi } from '../api';
import {
  CanonicalMarketOverview,
  CanonicalPrice,
  CanonicalVolume,
  MarketStateResult,
  AggregatedSignalResult,
  BehaviorAnalysisResult,
  AssetRiskResult,
} from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { RefreshCw, TrendingUp, ShieldAlert, Zap, Activity, Radio, BarChart3 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [overview, setOverview] = useState<CanonicalMarketOverview | null>(null);
  const [price, setPrice] = useState<CanonicalPrice | null>(null);
  const [volume, setVolume] = useState<CanonicalVolume | null>(null);
  const [marketState, setMarketState] = useState<MarketStateResult | null>(null);
  const [signal, setSignal] = useState<AggregatedSignalResult | null>(null);
  const [behavior, setBehavior] = useState<BehaviorAnalysisResult | null>(null);
  const [risk, setRisk] = useState<AssetRiskResult | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Fetch Market Overview
      const overviewRes = await marketApi.getOverview().catch(() => null);
      if (overviewRes) setOverview(overviewRes.data);

      // 2. Fetch specific asset telemetry concurrently
      const [priceRes, volRes, stateRes, sigRes, behRes, riskRes] = await Promise.allSettled([
        marketApi.getPrice(selectedSymbol),
        marketApi.getVolume(selectedSymbol),
        intelligenceApi.getMarketState(selectedSymbol, '1h', 100),
        signalsApi.getAssetSignal(selectedSymbol, '1h', 100),
        behaviorApi.getAssetBehavior(selectedSymbol, '1h', 100),
        riskApi.getAssetRisk(selectedSymbol, '1h', 100),
      ]);

      if (priceRes.status === 'fulfilled') setPrice(priceRes.value.data);
      if (volRes.status === 'fulfilled') setVolume(volRes.value.data);
      if (stateRes.status === 'fulfilled') setMarketState(stateRes.value.data);
      if (sigRes.status === 'fulfilled') setSignal(sigRes.value.data);
      if (behRes.status === 'fulfilled') setBehavior(behRes.value.data);
      if (riskRes.status === 'fulfilled') setRisk(riskRes.value.data);

      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ghost-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-ghost-textPrimary uppercase">
              Executive Telemetry
            </h1>
            <span className="px-2 py-0.5 rounded text-2xs font-mono bg-ghost-cyan/10 text-ghost-cyan border border-ghost-cyan/30">
              HIGH-PRECISION
            </span>
          </div>
          <p className="text-xs font-mono text-ghost-textMuted mt-0.5">
            Multi-layered quantitative market state, signals, order book behavior, and risk analytics
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <AssetSelector
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(sym) => setSelectedSymbol(sym)}
          />

          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-borderLight text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Sync</span>
          </button>

          {lastUpdated && (
            <span className="text-2xs text-ghost-textMuted hidden md:inline">
              UPDATED: {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {/* Data Origin Taxonomy Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs font-mono bg-ghost-darkest/60 border border-ghost-border/40 p-2.5 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-ghost-textMuted">LIVE DATA:</span>
          <span className="text-ghost-textPrimary font-semibold">Normalized Feeds</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span className="text-ghost-textMuted">CALCULATED:</span>
          <span className="text-ghost-textPrimary font-semibold">Zero-Lookahead</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-purple-400" />
          <span className="text-ghost-textMuted">MODEL OUTPUT:</span>
          <span className="text-ghost-textPrimary font-semibold">Bounded [0.05, 0.95]</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-slate-500" />
          <span className="text-ghost-textMuted">UNAVAILABLE:</span>
          <span className="text-ghost-textPrimary font-semibold">Graceful Degradation</span>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchDashboardData} />}

      {/* Row 1: Key Telemetry Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Asset Current Price (LIVE) */}
        <MetricCard
          label={`${selectedSymbol} PRICE`}
          value={price ? `$${price.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
          change={volume?.price_change_pct_24h}
          subValue={volume ? `24h High: $${volume.high_24h.toLocaleString()} | Low: $${volume.low_24h.toLocaleString()}` : undefined}
          icon={<TrendingUp className="w-4 h-4" />}
          badge={<span className="text-2xs font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">LIVE</span>}
          variant="default"
        />

        {/* Card 2: Market Regime (MODEL) */}
        <MetricCard
          label="MARKET REGIME"
          value={marketState ? marketState.state.replace('_', ' ') : '—'}
          subValue={marketState ? `Confidence: ${(marketState.confidence * 100).toFixed(1)}% | Conflicts: ${marketState.conflict_detected ? 'DETECTED' : 'NONE'}` : undefined}
          icon={<Radio className="w-4 h-4" />}
          badge={marketState ? <RiskBadge label={marketState.state} variant="state" size="sm" /> : undefined}
          variant="cyan"
        />

        {/* Card 3: Quantitative Signal (MODEL) */}
        <MetricCard
          label="CONSENSUS SIGNAL"
          value={signal ? signal.direction : '—'}
          subValue={signal ? `Consensus Confidence: ${(signal.confidence * 100).toFixed(1)}% | Strength: ${(signal.strength * 100).toFixed(1)}%` : undefined}
          icon={<Zap className="w-4 h-4" />}
          badge={signal ? <RiskBadge label={signal.direction} variant="signal" size="sm" /> : undefined}
          variant={signal?.direction === 'LONG' ? 'green' : signal?.direction === 'SHORT' ? 'red' : 'default'}
        />

        {/* Card 4: Quantitative Risk Level (CALCULATED/MODEL) */}
        <MetricCard
          label="QUANTITATIVE RISK"
          value={risk ? risk.risk_level : '—'}
          subValue={risk ? `Score: ${(risk.overall_risk_score * 100).toFixed(1)}/100 | Daily VaR 95%: ${(risk.var_metrics.var_95_daily * 100).toFixed(2)}%` : undefined}
          icon={<ShieldAlert className="w-4 h-4" />}
          badge={risk ? <RiskBadge label={risk.risk_level} variant="risk" size="sm" /> : undefined}
          variant={risk?.risk_level === 'CRITICAL' ? 'red' : risk?.risk_level === 'HIGH' ? 'amber' : 'green'}
        />
      </div>

      {/* Row 2: In-Depth Analytical Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: Cross-Asset Overview (Live Universe) */}
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-ghost-border/60 pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-ghost-cyan" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                  Market Universe
                </h3>
              </div>
              <span className="text-2xs font-mono text-ghost-textMuted">LIVE FEED</span>
            </div>

            {overview?.assets ? (
              <div className="space-y-2">
                {overview.assets.slice(0, 5).map((asset) => (
                  <div
                    key={asset.symbol}
                    onClick={() => setSelectedSymbol(asset.symbol)}
                    className={`flex items-center justify-between p-2 rounded-lg font-mono text-xs cursor-pointer transition-colors ${
                      asset.symbol === selectedSymbol
                        ? 'bg-ghost-cyan/10 border border-ghost-cyan/30 text-ghost-cyan'
                        : 'hover:bg-ghost-border/40 text-ghost-textPrimary'
                    }`}
                  >
                    <div>
                      <div className="font-bold">{asset.symbol}</div>
                      <div className="text-2xs text-ghost-textMuted">
                        Vol: ${(asset.volume_24h / 1e6).toFixed(1)}M
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div className={`text-2xs font-semibold ${asset.price_change_pct_24h >= 0 ? 'text-ghost-green' : 'text-ghost-red'}`}>
                        {asset.price_change_pct_24h >= 0 ? '+' : ''}{asset.price_change_pct_24h.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs font-mono text-ghost-textMuted py-8 text-center">
                Fetching market universe overview...
              </div>
            )}
          </div>
        </div>

        {/* Panel 2: Microstructure & Behavior Telemetry */}
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-ghost-border/60 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                  Behavior & Microstructure
                </h3>
              </div>
              <span className="text-2xs font-mono text-ghost-textMuted">MODEL INFERENCE</span>
            </div>

            {behavior ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Behavioral State:</span>
                  <RiskBadge label={behavior.primary_behavior_state} variant="state" size="sm" />
                </div>
                <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Book Asymmetry:</span>
                  <span className={`font-bold ${behavior.liquidity_pressure.depth_asymmetry > 0 ? 'text-ghost-green' : 'text-ghost-red'}`}>
                    {behavior.liquidity_pressure.depth_asymmetry > 0 ? '+' : ''}
                    {behavior.liquidity_pressure.depth_asymmetry.toFixed(3)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Spread:</span>
                  <span className="text-ghost-textPrimary">{behavior.liquidity_pressure.spread_bps.toFixed(2)} bps</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Resting Limit Walls:</span>
                  <span className="text-ghost-cyan font-bold">{behavior.whale_activity.large_resting_walls_count}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Absorption Ratio:</span>
                  <span className="text-ghost-textPrimary">{behavior.whale_activity.absorption_ratio.toFixed(2)}x</span>
                </div>

                <div className="p-2.5 rounded-lg bg-ghost-darkest border border-ghost-border/80 text-2xs text-slate-300 leading-relaxed">
                  <span className="text-ghost-cyan font-bold block mb-1">GAME THEORETIC SYNTHESIS:</span>
                  {behavior.game_theoretic_summary}
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-ghost-textMuted py-8 text-center">
                Computing order book microstructure behavior...
              </div>
            )}
          </div>
        </div>

        {/* Panel 3: Capital Preservation & Risk Boundaries */}
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-ghost-border/60 pb-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-ghost-red" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                  Risk & Position Bounds
                </h3>
              </div>
              <span className="text-2xs font-mono text-ghost-textMuted">CALCULATED METRICS</span>
            </div>

            {risk ? (
              <div className="space-y-2.5 font-mono text-xs">
                <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Max Position Cap:</span>
                  <span className="text-ghost-cyan font-bold">{(risk.position_sizing.max_position_pct * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Recommended Leverage:</span>
                  <span className="text-ghost-textPrimary font-bold">{risk.position_sizing.recommended_leverage}x</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Annualized Volatility:</span>
                  <span className="text-ghost-textPrimary">{(risk.volatility_annualized * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Historical Max Drawdown:</span>
                  <span className="text-ghost-red font-bold">{(risk.drawdown_metrics.max_drawdown * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Annualized Sharpe:</span>
                  <span className={`font-bold ${risk.risk_adjusted_metrics.sharpe_ratio >= 1.0 ? 'text-ghost-green' : 'text-ghost-amber'}`}>
                    {risk.risk_adjusted_metrics.sharpe_ratio.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Systematic Beta:</span>
                  <span className="text-ghost-textPrimary font-bold">{risk.sensitivity_metrics?.beta.toFixed(2) || '1.00'}x</span>
                </div>

                {risk.risk_warnings.length > 0 && (
                  <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 text-2xs text-rose-400">
                    <span className="font-bold">FLAG:</span> {risk.risk_warnings[0]}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs font-mono text-ghost-textMuted py-8 text-center">
                Evaluating asset risk parameters...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
