import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { marketApi, intelligenceApi, signalsApi, behaviorApi, riskApi } from '../api';
import {
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
import { RefreshCw, TrendingUp, Zap, ShieldAlert, Activity, ChevronRight, Info, CheckCircle2 } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [price, setPrice] = useState<CanonicalPrice | null>(null);
  const [volume, setVolume] = useState<CanonicalVolume | null>(null);
  const [marketState, setMarketState] = useState<MarketStateResult | null>(null);
  const [signal, setSignal] = useState<AggregatedSignalResult | null>(null);
  const [behavior, setBehavior] = useState<BehaviorAnalysisResult | null>(null);
  const [risk, setRisk] = useState<AssetRiskResult | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [showOutlookDetails, setShowOutlookDetails] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
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

  // Derived calculations matching strict TS types
  const priceDisplay = price ? `$${price.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—';
  const change24h = volume?.price_change_pct_24h ?? 0;
  const confidencePercent = marketState ? Math.round(marketState.confidence * 100) : 0;
  const agreementCount = signal ? Math.round(signal.consensus_metrics.agreement_ratio * signal.consensus_metrics.strategies_evaluated) : 0;
  const totalStrategies = signal ? signal.consensus_metrics.strategies_evaluated : 5;
  const riskLevel = risk?.risk_level || 'MODERATE';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Hero Header */}
      <div className="bg-ghost-card border border-ghost-border rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
              GHOST Market Intelligence
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-ghost-cyan/10 text-ghost-cyan border border-ghost-cyan/20">
              Live Overview
            </span>
          </div>
          <p className="text-sm text-ghost-textMuted mt-1">
            Understand market conditions, signals and risk in one place.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AssetSelector
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(sym) => setSelectedSymbol(sym)}
          />

          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-ghost-darkest border border-ghost-border rounded-lg hover:border-ghost-cyan/50 text-xs font-medium text-ghost-textPrimary hover:text-ghost-cyan transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Refresh</span>
          </button>

          {lastUpdated && (
            <span className="text-xs text-ghost-textDim font-mono hidden lg:inline">
              Updated {lastUpdated}
            </span>
          )}
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchDashboardData} />}

      {/* 4 Primary Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Asset Price"
          value={priceDisplay}
          change={change24h}
          subValue={volume ? `Vol $${(volume.volume_24h / 1e6).toFixed(1)}M` : undefined}
          icon={<TrendingUp className="w-4 h-4" />}
          onViewDetails={() => navigate('/market')}
        />

        <MetricCard
          label="Market Outlook"
          value={marketState ? marketState.state.replace('_', ' ') : 'Analyzing'}
          badge={<RiskBadge label={marketState?.state || 'NEUTRAL'} size="sm" />}
          subValue={marketState ? `Confidence: ${confidencePercent}%` : undefined}
          variant="cyan"
          icon={<Info className="w-4 h-4" />}
          onViewDetails={() => navigate('/market-state')}
        />

        <MetricCard
          label="Consensus Signal"
          value={signal ? signal.direction : 'Hold'}
          badge={<RiskBadge label={signal?.direction || 'NEUTRAL'} size="sm" />}
          subValue={signal ? `${agreementCount} / ${totalStrategies} strategies agree` : undefined}
          variant="green"
          icon={<Zap className="w-4 h-4" />}
          onViewDetails={() => navigate('/signals')}
        />

        <MetricCard
          label="Risk Profile"
          value={riskLevel}
          badge={<RiskBadge label={riskLevel} size="sm" />}
          subValue={risk ? `1D VaR 95%: ${(risk.var_metrics.var_95_daily * 100).toFixed(2)}%` : undefined}
          variant={riskLevel === 'HIGH' || riskLevel === 'CRITICAL' ? 'red' : 'amber'}
          icon={<ShieldAlert className="w-4 h-4" />}
          onViewDetails={() => navigate('/risk')}
        />
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Market Outlook & Activity (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Market Outlook Card */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-ghost-textPrimary">Market Outlook</h2>
                <RiskBadge label={marketState?.state || 'Analyzing'} size="sm" />
              </div>
              <button
                onClick={() => navigate('/market-state')}
                className="text-xs text-ghost-cyan hover:underline flex items-center gap-1 font-medium"
              >
                <span>Full outlook analysis</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Confidence Progress */}
              <div className="bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ghost-textMuted font-medium">Model Confidence</span>
                  <span className="font-mono font-bold text-ghost-cyan">{confidencePercent}%</span>
                </div>
                <div className="w-full bg-ghost-border/60 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-ghost-cyan h-full rounded-full transition-all duration-500"
                    style={{ width: `${confidencePercent}%` }}
                  />
                </div>
                <p className="text-xs text-ghost-textDim mt-2">
                  Evaluated across order book flow, trend momentum, and realized volatility.
                </p>
              </div>

              {/* Primary Evidence Bullets */}
              <div className="bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg p-4 space-y-2">
                <h3 className="text-xs font-semibold text-ghost-textMuted uppercase tracking-wider">
                  Supporting Evidence
                </h3>
                <ul className="space-y-1.5 text-xs text-ghost-textPrimary">
                  {marketState?.evidence?.slice(0, 3).map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="truncate">{item.rationale || item.indicator_name}</span>
                    </li>
                  )) || (
                    <li className="text-ghost-textMuted text-xs">Loading market evidence...</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Progressive Disclosure Toggle */}
            <div className="pt-2 border-t border-ghost-border/40 flex items-center justify-between">
              <button
                onClick={() => setShowOutlookDetails(!showOutlookDetails)}
                className="text-xs text-ghost-textMuted hover:text-ghost-textPrimary transition-colors flex items-center gap-1"
              >
                <span>{showOutlookDetails ? 'Hide technical details' : 'View model details & features'}</span>
                <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${showOutlookDetails ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {/* Expandable Model Details Drawer */}
            {showOutlookDetails && marketState && (
              <div className="p-4 bg-ghost-darkest rounded-lg border border-ghost-border/80 text-xs font-mono space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-ghost-textMuted">
                  <div>
                    <span className="block text-[10px] text-ghost-textDim">REGIME CODE</span>
                    <strong className="text-ghost-textPrimary">{marketState.state}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-ghost-textDim">MODEL VERSION</span>
                    <strong className="text-ghost-cyan">{marketState.model_version}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-ghost-textDim">CONFLICT DETECTED</span>
                    <strong className={marketState.conflict_detected ? 'text-amber-400' : 'text-emerald-400'}>
                      {marketState.conflict_detected ? 'Yes' : 'None'}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-ghost-textDim">EVALUATED AT</span>
                    <strong className="text-ghost-textPrimary">{new Date(marketState.timestamp).toLocaleTimeString()}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Market Activity (Microstructure Insights) */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-ghost-cyan" />
                <h2 className="text-base font-semibold text-ghost-textPrimary">Market Activity</h2>
              </div>
              <button
                onClick={() => navigate('/behavior')}
                className="text-xs text-ghost-cyan hover:underline flex items-center gap-1 font-medium"
              >
                <span>Detailed activity model</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3.5 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-1">
                <span className="text-xs text-ghost-textMuted font-medium">Order Book Imbalance</span>
                <div className="text-lg font-mono font-bold text-ghost-textPrimary">
                  {behavior ? `${(behavior.liquidity_pressure.net_imbalance * 100).toFixed(1)}%` : '—'}
                </div>
                <p className="text-[11px] text-ghost-textDim">
                  {behavior && behavior.liquidity_pressure.net_imbalance > 0 ? 'Net buying interest' : 'Net selling pressure'}
                </p>
              </div>

              <div className="p-3.5 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-1">
                <span className="text-xs text-ghost-textMuted font-medium">Resting Order Walls</span>
                <div className="text-lg font-mono font-bold text-ghost-textPrimary">
                  {behavior ? `${behavior.whale_activity.large_resting_walls_count} Walls` : '—'}
                </div>
                <p className="text-[11px] text-ghost-textDim">Liquidity depth barriers detected</p>
              </div>

              <div className="p-3.5 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-1">
                <span className="text-xs text-ghost-textMuted font-medium">Dominant Archetype</span>
                <div className="text-lg font-mono font-bold text-ghost-cyan truncate capitalize">
                  {behavior?.participant_inferences?.[0]?.archetype.replace('_', ' ') || 'Market Makers'}
                </div>
                <p className="text-[11px] text-ghost-textDim">Primary order flow source</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Signals & Risk Breakdown */}
        <div className="space-y-6">
          {/* Signals Breakdown Card */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <h2 className="text-base font-semibold text-ghost-textPrimary">Signals Engine</h2>
              </div>
              <button
                onClick={() => navigate('/signals')}
                className="text-xs text-ghost-cyan hover:underline flex items-center gap-1 font-medium"
              >
                <span>View engines</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-ghost-textMuted mb-1">
                <span>Strategy Consensus</span>
                <span className="font-mono font-bold text-ghost-textPrimary">{agreementCount} / {totalStrategies} Agree</span>
              </div>

              <div className="space-y-1.5 font-sans text-xs">
                {signal?.strategy_signals ? (
                  signal.strategy_signals.slice(0, 4).map((strat) => (
                    <div
                      key={strat.strategy_name}
                      className="p-2.5 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg flex items-center justify-between"
                    >
                      <span className="text-ghost-textMuted font-medium capitalize">
                        {strat.strategy_name.replace('_', ' ')}
                      </span>
                      <RiskBadge label={strat.direction} size="sm" />
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-ghost-textMuted p-2">Loading strategy consensus...</p>
                )}
              </div>
            </div>
          </div>

          {/* Quantitative Risk Summary Card */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <h2 className="text-base font-semibold text-ghost-textPrimary">Risk Summary</h2>
              </div>
              <button
                onClick={() => navigate('/risk')}
                className="text-xs text-ghost-cyan hover:underline flex items-center gap-1 font-medium"
              >
                <span>Full risk evaluation</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-3 font-sans text-xs">
              <div className="flex items-center justify-between p-2.5 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg">
                <span className="text-ghost-textMuted font-medium">Annualized Volatility</span>
                <span className="font-mono font-bold text-ghost-textPrimary">
                  {risk ? `${(risk.volatility_annualized * 100).toFixed(1)}%` : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg">
                <span className="text-ghost-textMuted font-medium">1D VaR (95%)</span>
                <span className="font-mono font-bold text-rose-400">
                  {risk ? `${(risk.var_metrics.var_95_daily * 100).toFixed(2)}%` : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg">
                <span className="text-ghost-textMuted font-medium">Max Drawdown</span>
                <span className="font-mono font-bold text-amber-400">
                  {risk ? `${(risk.drawdown_metrics.max_drawdown * 100).toFixed(1)}%` : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg">
                <span className="text-ghost-textMuted font-medium">Position Sizing Cap</span>
                <span className="font-mono font-bold text-ghost-cyan">
                  {risk ? `${(risk.position_sizing.max_position_pct * 100).toFixed(0)}%` : '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
