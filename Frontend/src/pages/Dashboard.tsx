import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signalsApi,
  balanceService,
  BalanceItem,
} from '../api';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useMarket } from '../context/MarketContext';
import { AggregatedSignalResult } from '../types';
import {
  Zap,
  ShieldAlert,
  ArrowRight,
  Wallet,
  Scale,
  Plus,
  X,
  TrendingUp,
  TrendingDown,
  Search,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const {
    markets,
    watchlist,
    addToWatchlist,
    removeFromWatchlist,
    liveSnapshots,
    getLivePrice,
    setSelectedSymbol,
  } = useMarket();

  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [signal, setSignal] = useState<AggregatedSignalResult | null>(null);
  const [isAddMarketOpen, setIsAddMarketOpen] = useState<boolean>(false);
  const [marketSearchQuery, setMarketSearchQuery] = useState<string>('');

  useEffect(() => {
    balanceService.getBalances().then(setBalances).catch(() => setBalances([]));
    signalsApi
      .getAssetSignal('BTC/USDT')
      .then((res: any) => setSignal(res.data))
      .catch(() => setSignal(null));
  }, []);

  // Compute total portfolio value with dynamic market prices
  const portfolioValue = useMemo(() => {
    let total = 0;
    balances.forEach((b) => {
      const sym = b.symbol.toUpperCase();
      if (sym.includes('USDT') || sym.includes('USDC') || sym.includes('DAI') || sym.includes('FDUSD')) {
        total += b.quantity;
      } else {
        const live = getLivePrice(sym);
        if (live) {
          total += live * b.quantity;
        } else if (sym.includes('BTC')) {
          total += (getLivePrice('BTCUSDT') || 84000) * b.quantity;
        } else if (sym.includes('ETH')) {
          total += (getLivePrice('ETHUSDT') || 3400) * b.quantity;
        } else if (sym.includes('SOL')) {
          total += (getLivePrice('SOLUSDT') || 180) * b.quantity;
        }
      }
    });
    return total > 0 ? total : 24820.4; // Baseline if wallet unlinked
  }, [balances, getLivePrice]);

  // Available markets not yet in watchlist
  const availableToAdd = useMemo(() => {
    const q = marketSearchQuery.toLowerCase();
    return markets.filter((m) => {
      const notInWatchlist = !watchlist.includes(m.symbol);
      const matches =
        m.symbol.toLowerCase().includes(q) ||
        m.displaySymbol.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.baseAsset.toLowerCase().includes(q);
      return notInWatchlist && matches;
    });
  }, [markets, watchlist, marketSearchQuery]);

  // Risk parameters
  const capital = profile?.capital || 25000;
  const dailyLossLimitPct = profile?.dailyLossLimit || 2.0;
  const dailyRiskLimit = capital * (dailyLossLimitPct / 100);
  const plannedRisk = capital * ((profile?.riskPerTrade || 1.0) / 100);
  const riskProgress = Math.min((plannedRisk / dailyRiskLimit) * 100, 100);

  const greetingHour = new Date().getHours();
  const greeting =
    greetingHour < 12 ? 'Good morning' : greetingHour < 18 ? 'Good afternoon' : 'Good evening';
  const displayName = user?.email ? user.email.split('@')[0] : 'Investor';

  const handleSelectMarket = (symbol: string) => {
    setSelectedSymbol(symbol);
    navigate('/market');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 font-sans">
      {/* 1. Warm Human Greeting */}
      <div className="space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ghost-textPrimary">
          {greeting}, {displayName}.
        </h1>
        <p className="text-xs sm:text-sm text-ghost-textMuted">
          Here is what matters across your portfolio and tracked markets today.
        </p>
      </div>

      {/* 2. Hero: Portfolio Value & Asset Allocation */}
      <div className="p-6 sm:p-8 rounded-3xl bg-ghost-card border border-ghost-border/80 shadow-md space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-ghost-sand">
            <Wallet className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider text-ghost-textMuted">
              Your Portfolio
            </span>
          </div>

          <button
            onClick={() => navigate('/portfolio-risk')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ghost-sand hover:underline self-start sm:self-auto"
          >
            <span>View portfolio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl sm:text-5xl font-extrabold text-ghost-textPrimary tracking-tight font-sans">
            ${portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            +2.4% today
          </span>
        </div>

        {/* Visual Allocation Strip */}
        <div className="space-y-2 pt-2 border-t border-ghost-border/50">
          <div className="h-2 w-full bg-ghost-darkest rounded-full overflow-hidden flex gap-0.5">
            <div className="h-full bg-ghost-sand rounded-l-full" style={{ width: '52%' }} title="BTC 52%" />
            <div className="h-full bg-ghost-burgundyLight" style={{ width: '28%' }} title="ETH 28%" />
            <div className="h-full bg-amber-500" style={{ width: '12%' }} title="SOL 12%" />
            <div className="h-full bg-emerald-600 rounded-r-full" style={{ width: '8%' }} title="USDT 8%" />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px] text-ghost-textMuted font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-ghost-sand" /> BTC 52%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-ghost-burgundyLight" /> ETH 28%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> SOL 12%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-600" /> USDT 8%
            </span>
          </div>
        </div>
      </div>

      {/* 3. Tracked Markets Grid with Real-Time Data */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold text-ghost-textMuted uppercase tracking-wider">
              Tracked Markets
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-ghost-bg border border-ghost-border text-ghost-sand">
              {watchlist.length} active
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsAddMarketOpen(true)}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-xl bg-ghost-card border border-ghost-border text-ghost-sand hover:border-ghost-sand/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add market</span>
            </button>
            <button
              onClick={() => navigate('/market')}
              className="text-xs font-semibold text-ghost-sand hover:underline flex items-center gap-1"
            >
              <span>All markets</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {watchlist.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-ghost-card border border-ghost-border/70 space-y-3">
            <p className="text-xs text-ghost-textMuted">No markets added to your watchlist yet.</p>
            <button
              onClick={() => setIsAddMarketOpen(true)}
              className="px-4 py-2 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold text-xs border border-ghost-sand/30 hover:bg-[#6c1219] transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Track crypto markets</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchlist.map((sym) => {
              const def = markets.find((m) => m.symbol === sym);
              const snap = liveSnapshots[sym];
              const display = def ? def.displaySymbol : sym;
              const name = def?.name || def?.baseAsset || sym;
              const price = snap?.price ?? 0;
              const changePct = snap?.priceChangePercent24h ?? 0;
              const isStale = snap?.freshness === 'STALE';
              const isLive = snap?.freshness === 'LIVE';

              return (
                <div
                  key={sym}
                  onClick={() => handleSelectMarket(sym)}
                  className="group relative p-5 rounded-2xl bg-ghost-card border border-ghost-border/70 hover:border-ghost-sand/40 hover:bg-ghost-cardHover transition-all cursor-pointer shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-ghost-textPrimary font-mono">
                        {display}
                      </span>
                      <span className="text-[11px] text-ghost-textMuted font-sans">
                        {name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isLive ? 'bg-emerald-400 animate-pulse' : isStale ? 'bg-amber-400' : 'bg-ghost-textMuted'
                        }`}
                        title={isLive ? 'Live WebSocket stream' : isStale ? 'Stale data (>15s)' : 'Waiting for tick'}
                      />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromWatchlist(sym);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-ghost-textMuted hover:text-rose-400 hover:bg-ghost-bg transition-all"
                        title="Remove from watchlist"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold font-mono text-ghost-sand">
                      {price > 0
                        ? `$${price.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: price < 1 ? 4 : 2,
                          })}`
                        : 'Streaming...'}
                    </span>

                    {price > 0 && (
                      <span
                        className={`inline-flex items-center gap-0.5 text-xs font-bold font-mono px-2 py-0.5 rounded-full border ${
                          changePct >= 0
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {changePct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                        <span>{changePct >= 0 ? `+${changePct.toFixed(2)}%` : `${changePct.toFixed(2)}%`}</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Market Modal */}
      {isAddMarketOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ghost-card border border-ghost-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border">
              <div>
                <h3 className="text-base font-bold text-ghost-textPrimary">
                  Add Markets to Watchlist
                </h3>
                <p className="text-xs text-ghost-textMuted">
                  Select cryptocurrency pairs to monitor in real-time.
                </p>
              </div>
              <button
                onClick={() => setIsAddMarketOpen(false)}
                className="p-1.5 rounded-lg text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-bg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-ghost-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search coin or pair (e.g. SOL, BNB, XRP)..."
                value={marketSearchQuery}
                onChange={(e) => setMarketSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-ghost-bg border border-ghost-border rounded-xl text-xs text-ghost-textPrimary placeholder:text-ghost-textMuted focus:outline-none focus:border-ghost-sand"
                autoFocus
              />
            </div>

            {/* Available Markets List */}
            <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-ghost-border/30">
              {availableToAdd.length === 0 ? (
                <div className="p-4 text-center text-xs text-ghost-textMuted">
                  {marketSearchQuery ? 'No matching cryptocurrencies found.' : 'All available markets are in your watchlist.'}
                </div>
              ) : (
                availableToAdd.map((m) => (
                  <div
                    key={m.symbol}
                    className="pt-1.5 pb-1.5 px-2 flex items-center justify-between hover:bg-ghost-cardHover rounded-lg transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-ghost-textPrimary">
                          {m.displaySymbol}
                        </span>
                        <span className="text-[11px] text-ghost-textMuted font-sans">
                          {m.name}
                        </span>
                      </div>
                      <span className="text-[10px] text-ghost-textMuted font-mono">
                        Binance Spot · {m.quoteAsset}
                      </span>
                    </div>

                    <button
                      onClick={() => addToWatchlist(m.symbol)}
                      className="px-3 py-1 rounded-lg bg-ghost-sand/15 text-ghost-sand border border-ghost-sand/30 hover:bg-ghost-sand/25 text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Track</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-ghost-border flex justify-end">
              <button
                onClick={() => setIsAddMarketOpen(false)}
                className="px-4 py-2 rounded-xl bg-ghost-bg border border-ghost-border text-xs font-semibold text-ghost-textPrimary hover:border-ghost-sand/40 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Dual Section: Market Outlook & Risk Monitor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Market Outlook / Signals Context */}
        <div className="p-6 rounded-2xl bg-ghost-card border border-ghost-border/70 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-ghost-sand" />
                <h3 className="text-xs font-bold text-ghost-textPrimary uppercase tracking-wider">
                  Market Outlook
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Supportive Momentum
              </span>
            </div>

            <p className="text-xs text-ghost-textMuted leading-relaxed">
              Major crypto assets are consolidating with constructive moving average alignment. Volatility remains contained as volume supports the recent expansion above local swing levels.
            </p>

            {signal && (
              <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/50 text-[11px] text-ghost-textMuted flex items-center justify-between">
                <span>Signal Consensus</span>
                <strong className="text-ghost-sand font-mono">
                  {Math.round(signal.confidence * 100)}% Confidence
                </strong>
              </div>
            )}
          </div>

          <button
            onClick={() => navigate('/signals')}
            className="w-full py-2.5 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold text-xs border border-ghost-sand/30 hover:bg-[#6c1219] shadow transition-all flex items-center justify-center gap-2"
          >
            <span>View evidence-based analysis</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Risk Monitor */}
        <div className="p-6 rounded-2xl bg-ghost-card border border-ghost-border/70 shadow-sm flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-300" />
                <h3 className="text-xs font-bold text-ghost-textPrimary uppercase tracking-wider">
                  Risk Management
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                Moderate Exposure
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-bold text-ghost-sand font-mono">
                  ${plannedRisk.toLocaleString()}
                </span>
                <span className="text-xs text-ghost-textMuted">
                  of ${dailyRiskLimit.toLocaleString()} daily budget
                </span>
              </div>

              <div className="h-2 bg-ghost-darkest rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    riskProgress > 80 ? 'bg-rose-500' : riskProgress > 50 ? 'bg-amber-400' : 'bg-ghost-sand'
                  }`}
                  style={{ width: `${riskProgress}%` }}
                />
              </div>

              <p className="text-xs text-ghost-textMuted leading-relaxed pt-1">
                You have approximately{' '}
                <strong className="text-ghost-textPrimary font-semibold">
                  ${(dailyRiskLimit - plannedRisk).toLocaleString()}
                </strong>{' '}
                of risk tolerance remaining before hitting your planned limit.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/portfolio-risk')}
            className="w-full py-2.5 rounded-xl border border-ghost-border bg-ghost-cardHover text-ghost-textPrimary hover:text-ghost-sand hover:border-ghost-sand/40 font-semibold text-xs transition-all flex items-center justify-center gap-2"
          >
            <span>View detailed risk metrics</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 5. Signature Feature Quick Launch: Courtroom */}
      <div className="p-6 sm:p-7 rounded-3xl bg-ghost-card border border-ghost-border/80 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-2xl bg-ghost-burgundy/30 border border-ghost-sand/30 flex items-center justify-center text-ghost-sand shrink-0 mt-0.5">
            <Scale className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-ghost-textPrimary">
              Have a market thesis? Stress-test it in the Courtroom.
            </h3>
            <p className="text-xs text-ghost-textMuted max-w-xl leading-relaxed">
              Challenge your conviction with adversarial arguments, contradictory evidence, and objective invalidation criteria before entering a trade.
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/courtroom')}
          className="px-5 py-2.5 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold text-xs border border-ghost-sand/30 hover:bg-[#6c1219] shadow transition-all shrink-0 flex items-center gap-2 self-start sm:self-auto"
        >
          <span>Open Courtroom</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
