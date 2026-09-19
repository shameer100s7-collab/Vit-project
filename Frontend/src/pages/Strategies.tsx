import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Plus,
  Search,
  Cpu,
  AlertTriangle,
  HelpCircle,
  Lock,
  RefreshCw,
} from 'lucide-react';
import { strategiesApi } from '../api';
import { StrategyItem, VerificationBadgeType, StrategyCreatePayload } from '../types';

export const Strategies: React.FC = () => {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBadge, setSelectedBadge] = useState<string>('ALL');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  // Form State for Strategy Creator
  const [formData, setFormData] = useState<StrategyCreatePayload>({
    name: '',
    description: '',
    asset: 'BTC/USDT',
    timeframe: '1h',
    entry_condition: 'EMA9 > EMA21 and RSI > 45',
    exit_condition: 'EMA9 < EMA21 or StopLoss',
    stop_loss_pct: 2.5,
    take_profit_pct: 5.0,
    position_sizing_pct: 100.0,
    fast_period: 9,
    slow_period: 21,
    rsi_period: 14,
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadStrategies = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await strategiesApi.list();
      setStrategies(data || []);
    } catch (err: any) {
      setError(err?.message || 'DATA UNAVAILABLE: Unable to load strategy registry.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStrategies();
  }, []);

  // Filter strategies
  const filteredStrategies = useMemo(() => {
    return strategies.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.asset.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.strategy_hash.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesBadge = selectedBadge === 'ALL' || s.verification_badge === selectedBadge;
      return matchesSearch && matchesBadge;
    });
  }, [strategies, searchQuery, selectedBadge]);

  // Compute live canonical preview for creator modal
  const canonicalPreview = useMemo(() => {
    const rules = {
      asset: formData.asset,
      entry: formData.entry_condition,
      exit: formData.exit_condition,
      fast_period: formData.fast_period,
      name: formData.name || 'Untitled Strategy',
      position_sizing_pct: formData.position_sizing_pct,
      rsi_period: formData.rsi_period,
      slow_period: formData.slow_period,
      stop_loss_pct: formData.stop_loss_pct,
      take_profit_pct: formData.take_profit_pct,
      timeframe: formData.timeframe,
    };
    return JSON.stringify(rules, Object.keys(rules).sort(), 2);
  }, [formData]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setCreateError('Strategy name is required.');
      return;
    }
    setIsSubmitting(true);
    setCreateError(null);
    try {
      const created = await strategiesApi.create(formData);
      setIsCreateModalOpen(false);
      navigate(`/strategies/${created.id}`);
    } catch (err: any) {
      setCreateError(err?.message || 'Failed to register strategy.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getBadgeStyle = (badge: VerificationBadgeType) => {
    switch (badge) {
      case 'VERIFIED':
        return {
          label: 'VERIFIED',
          cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          dot: 'bg-emerald-400',
        };
      case 'PARTIALLY_VERIFIED':
        return {
          label: 'PARTIALLY VERIFIED',
          cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          dot: 'bg-amber-400',
        };
      case 'ANOMALY_DETECTED':
        return {
          label: 'ANOMALY DETECTED',
          cls: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          dot: 'bg-rose-400',
        };
      case 'UNDER_REVIEW':
        return {
          label: 'UNDER REVIEW',
          cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          dot: 'bg-blue-400',
        };
      default:
        return {
          label: 'INSUFFICIENT DATA',
          cls: 'bg-ghost-border/40 text-ghost-textMuted border-ghost-border',
          dot: 'bg-ghost-textMuted',
        };
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-ghost-sand" />
            <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
              Strategy Verification Registry
            </h1>
          </div>
          <p className="text-xs text-ghost-textMuted mt-1">
            Independently verify algorithmic crypto trading strategies with real exchange datasets, backtests, and on-chain immutability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadStrategies}
            disabled={isLoading}
            className="p-2 rounded-xl bg-ghost-card border border-ghost-border hover:text-ghost-sand text-ghost-textMuted transition-colors"
            title="Refresh Strategies"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-ghost-sand' : ''}`} />
          </button>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold text-xs border border-ghost-sand/30 hover:bg-[#6c1219] shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Register Strategy</span>
          </button>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-ghost-textMuted" />
          <input
            type="text"
            placeholder="Search by strategy name, asset, or hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-ghost-card border border-ghost-border text-xs text-ghost-textPrimary focus:outline-none focus:border-ghost-sand"
          />
        </div>

        {/* Badge Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {['ALL', 'VERIFIED', 'PARTIALLY_VERIFIED', 'ANOMALY_DETECTED', 'INSUFFICIENT_DATA'].map((badge) => (
            <button
              key={badge}
              onClick={() => setSelectedBadge(badge)}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                selectedBadge === badge
                  ? 'bg-ghost-sand/15 text-ghost-sand border-ghost-sand/50 font-semibold'
                  : 'bg-ghost-card/50 text-ghost-textMuted border-ghost-border hover:text-ghost-textPrimary'
              }`}
            >
              {badge.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Strategies List / Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-ghost-textMuted flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-ghost-sand" />
          <span>Synchronizing strategy registry from on-chain & backtest cache...</span>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-2">
          <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto" />
          <p className="text-xs text-rose-200">{error}</p>
          <button
            onClick={loadStrategies}
            className="px-3 py-1 rounded-lg bg-rose-500/20 text-xs font-semibold text-rose-200"
          >
            Retry
          </button>
        </div>
      ) : filteredStrategies.length === 0 ? (
        <div className="py-16 text-center text-xs text-ghost-textMuted bg-ghost-card/30 rounded-2xl border border-ghost-border p-8 space-y-2">
          <HelpCircle className="w-6 h-6 text-ghost-textMuted mx-auto" />
          <p className="font-semibold text-ghost-textPrimary">No strategies found</p>
          <p>Register your first strategy to execute real historical backtests and on-chain proofs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredStrategies.map((strat) => {
            const bStyle = getBadgeStyle(strat.verification_badge);
            return (
              <div
                key={strat.id}
                onClick={() => navigate(`/strategies/${strat.id}`)}
                className="group p-5 rounded-2xl bg-ghost-card border border-ghost-border hover:border-ghost-sand/50 transition-all duration-200 shadow-sm cursor-pointer flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-ghost-textPrimary group-hover:text-ghost-sand transition-colors">
                        {strat.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-ghost-bg border border-ghost-border text-ghost-textMuted">
                          {strat.asset}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-ghost-bg border border-ghost-border text-ghost-textMuted">
                          {strat.timeframe.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {/* Verification Badge */}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${bStyle.cls}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${bStyle.dot}`} />
                      <span>{bStyle.label}</span>
                    </span>
                  </div>

                  {strat.description && (
                    <p className="text-xs text-ghost-textMuted line-clamp-2 leading-relaxed">
                      {strat.description}
                    </p>
                  )}
                </div>

                <div className="space-y-3 pt-3 border-t border-ghost-border/50 text-xs">
                  {/* Verification & Return Summary */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-xl bg-ghost-bg border border-ghost-border/40">
                      <span className="text-[10px] text-ghost-textMuted uppercase block">Score</span>
                      <strong className="text-xs font-mono text-ghost-sand">
                        {strat.verification_score !== null && strat.verification_score !== undefined
                          ? `${Math.round(strat.verification_score)}/100`
                          : 'N/A'}
                      </strong>
                    </div>

                    <div className="p-2 rounded-xl bg-ghost-bg border border-ghost-border/40">
                      <span className="text-[10px] text-ghost-textMuted uppercase block">Return</span>
                      <strong
                        className={`text-xs font-mono ${
                          (strat.total_return_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {strat.total_return_pct !== null && strat.total_return_pct !== undefined
                          ? `${strat.total_return_pct > 0 ? '+' : ''}${strat.total_return_pct.toFixed(1)}%`
                          : 'Not Run'}
                      </strong>
                    </div>

                    <div className="p-2 rounded-xl bg-ghost-bg border border-ghost-border/40">
                      <span className="text-[10px] text-ghost-textMuted uppercase block">Win Rate</span>
                      <strong className="text-xs font-mono text-ghost-textPrimary">
                        {strat.win_rate !== null && strat.win_rate !== undefined
                          ? `${strat.win_rate.toFixed(0)}%`
                          : '—'}
                      </strong>
                    </div>
                  </div>

                  {/* On-Chain Footprint */}
                  <div className="flex items-center justify-between text-[11px] text-ghost-textMuted pt-1">
                    <div className="flex items-center gap-1.5 font-mono">
                      {strat.is_onchain ? (
                        <>
                          <Lock className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 truncate max-w-[140px]">
                            {strat.tx_hash ? `${strat.tx_hash.slice(0, 10)}...` : 'On-Chain Proof'}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-ghost-textMuted" />
                          <span>Not Registered</span>
                        </>
                      )}
                    </div>
                    <span className="text-ghost-sand font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Verify Strategy &rarr;
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Register Strategy Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ghost-card border border-ghost-border rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-ghost-sand" />
                <h2 className="text-base font-bold text-ghost-textPrimary">
                  Register Machine-Readable Strategy
                </h2>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-ghost-textMuted hover:text-ghost-textPrimary text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ghost-textMuted font-medium mb-1">Strategy Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BTC Dual EMA Breakout"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-ghost-bg border border-ghost-border text-ghost-textPrimary focus:outline-none focus:border-ghost-sand"
                  />
                </div>

                <div>
                  <label className="block text-ghost-textMuted font-medium mb-1">Trading Asset</label>
                  <select
                    value={formData.asset}
                    onChange={(e) => setFormData({ ...formData, asset: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-ghost-bg border border-ghost-border text-ghost-textPrimary focus:outline-none focus:border-ghost-sand font-mono"
                  >
                    <option value="BTC/USDT">BTC/USDT (Binance)</option>
                    <option value="ETH/USDT">ETH/USDT (Binance)</option>
                    <option value="SOL/USDT">SOL/USDT (Binance)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-ghost-textMuted font-medium mb-1">Description / Thesis</label>
                <textarea
                  rows={2}
                  placeholder="Operational rationale and structural setup..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-ghost-bg border border-ghost-border text-ghost-textPrimary focus:outline-none focus:border-ghost-sand"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-ghost-textMuted font-medium mb-1">Timeframe</label>
                  <select
                    value={formData.timeframe}
                    onChange={(e) => setFormData({ ...formData, timeframe: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-ghost-bg border border-ghost-border text-ghost-textPrimary focus:outline-none focus:border-ghost-sand font-mono"
                  >
                    <option value="15m">15m</option>
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                    <option value="1d">1d</option>
                  </select>
                </div>

                <div>
                  <label className="block text-ghost-textMuted font-medium mb-1">Fast Period (EMA)</label>
                  <input
                    type="number"
                    min={2}
                    max={100}
                    value={formData.fast_period}
                    onChange={(e) => setFormData({ ...formData, fast_period: parseInt(e.target.value) || 9 })}
                    className="w-full px-3 py-2 rounded-xl bg-ghost-bg border border-ghost-border text-ghost-textPrimary font-mono"
                  />
                </div>

                <div>
                  <label className="block text-ghost-textMuted font-medium mb-1">Slow Period (EMA)</label>
                  <input
                    type="number"
                    min={3}
                    max={200}
                    value={formData.slow_period}
                    onChange={(e) => setFormData({ ...formData, slow_period: parseInt(e.target.value) || 21 })}
                    className="w-full px-3 py-2 rounded-xl bg-ghost-bg border border-ghost-border text-ghost-textPrimary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-ghost-textMuted font-medium mb-1">
                    Stop Loss Percentage ({formData.stop_loss_pct}%)
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="10.0"
                    step="0.5"
                    value={formData.stop_loss_pct}
                    onChange={(e) => setFormData({ ...formData, stop_loss_pct: parseFloat(e.target.value) })}
                    className="w-full accent-ghost-sand"
                  />
                </div>

                <div>
                  <label className="block text-ghost-textMuted font-medium mb-1">
                    Take Profit Percentage ({formData.take_profit_pct}%)
                  </label>
                  <input
                    type="range"
                    min="1.0"
                    max="20.0"
                    step="0.5"
                    value={formData.take_profit_pct}
                    onChange={(e) => setFormData({ ...formData, take_profit_pct: parseFloat(e.target.value) })}
                    className="w-full accent-ghost-sand"
                  />
                </div>
              </div>

              {/* Canonical Rules JSON Preview */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-ghost-sand uppercase">
                    Canonical Machine-Readable Rules Preview
                  </span>
                  <span className="text-[10px] text-ghost-textMuted">Deterministic Canonical JSON</span>
                </div>
                <pre className="p-3 rounded-xl bg-ghost-darkest border border-ghost-border/80 font-mono text-[11px] text-ghost-sand overflow-x-auto">
                  {canonicalPreview}
                </pre>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-ghost-border">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-ghost-border text-ghost-textMuted hover:text-ghost-textPrimary font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold border border-ghost-sand/30 hover:bg-[#6c1219] shadow transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Canonicalizing & Hashing...' : 'Canonicalize & Register Strategy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
