import React, { useEffect, useState } from 'react';
import { signalsApi } from '../api';
import { useProfile } from '../context/ProfileContext';
import { AggregatedSignalResult } from '../types';
import { useLivePrice } from '../hooks/useLivePrice';
import { Zap, Activity, TrendingUp, TrendingDown, Clock, ShieldAlert } from 'lucide-react';

const SignalCard: React.FC<{ symbol: string; signal: AggregatedSignalResult }> = ({ symbol, signal }) => {
  const { profile } = useProfile();
  const livePrice = useLivePrice(symbol);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Derive mock setup values based on current live price for UI illustration
  const price = livePrice || 0;
  const isLong = signal.direction === 'LONG';
  const isShort = signal.direction === 'SHORT';
  
  // Calculate mock entry/stop/target since the backend doesn't provide exact price levels
  const entryHigh = price > 0 ? (price * 1.002).toFixed(price > 1000 ? 0 : 2) : '---';
  const entryLow = price > 0 ? (price * 0.998).toFixed(price > 1000 ? 0 : 2) : '---';
  
  const stop = price > 0 ? (isLong ? price * 0.98 : price * 1.02).toFixed(price > 1000 ? 0 : 2) : '---';
  const target = price > 0 ? (isLong ? price * 1.04 : price * 0.96).toFixed(price > 1000 ? 0 : 2) : '---';
  
  const plannedRisk = (profile?.capital || 10000) * ((profile?.riskPerTrade || 1) / 100);
  const agreementCount = Math.round(signal.consensus_metrics.agreement_ratio * signal.consensus_metrics.strategies_evaluated);

  return (
    <div className="bg-ghost-card border border-ghost-border rounded-2xl p-6 shadow-sm flex flex-col hover:border-ghost-border/80 transition-all group">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-ghost-textPrimary">{symbol}</h2>
          {isLong && <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Buy Setup</span>}
          {isShort && <span className="bg-rose-500/10 text-rose-400 px-2 py-1 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1"><TrendingDown className="w-3 h-3" /> Sell Setup</span>}
          {signal.direction === 'NEUTRAL' && <span className="bg-ghost-border/50 text-ghost-textMuted px-2 py-1 rounded text-xs font-bold uppercase tracking-wider">Neutral</span>}
        </div>
        <div className="text-right">
          <div className="text-xs text-ghost-textMuted mb-0.5">Current price</div>
          <div className="font-mono text-lg font-semibold text-ghost-textPrimary">
            {price > 0 ? `$${price.toLocaleString()}` : '---'}
          </div>
        </div>
      </div>

      {(isLong || isShort) ? (
        <div className="space-y-4 flex-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-ghost-darkest/50 rounded-xl border border-ghost-border/40">
              <div className="text-xs text-ghost-textMuted mb-1">Entry zone</div>
              <div className="font-mono text-ghost-textPrimary font-medium">${entryLow} – ${entryHigh}</div>
            </div>
            <div className="p-3 bg-ghost-darkest/50 rounded-xl border border-ghost-border/40">
              <div className="text-xs text-ghost-textMuted mb-1">Potential target</div>
              <div className="font-mono text-emerald-400 font-medium">${target}</div>
            </div>
            <div className="p-3 bg-ghost-darkest/50 rounded-xl border border-ghost-border/40">
              <div className="text-xs text-ghost-textMuted mb-1">Stop loss</div>
              <div className="font-mono text-rose-400 font-medium">${stop}</div>
            </div>
            <div className="p-3 bg-ghost-darkest/50 rounded-xl border border-ghost-border/40">
              <div className="text-xs text-ghost-textMuted mb-1">Risk / Reward</div>
              <div className="font-mono text-ghost-textPrimary font-medium">{profile?.riskRewardPreference || '1 : 2'}</div>
            </div>
          </div>
          
          <div className="flex justify-between items-center px-2">
            <div className="text-sm text-ghost-textMuted flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>Your planned risk</span>
            </div>
            <div className="font-mono text-ghost-textPrimary font-medium">${plannedRisk.toLocaleString()}</div>
          </div>

          <div className="pt-4 border-t border-ghost-border/40">
            <h4 className="text-sm font-semibold text-ghost-textPrimary mb-2">Why this setup?</h4>
            <div className="flex items-start gap-2 text-sm text-ghost-textMuted">
              <Activity className="w-4 h-4 mt-0.5 shrink-0 text-ghost-cyan" />
              <p>{agreementCount} out of {signal.consensus_metrics.strategies_evaluated} factors support this setup based on recent momentum and quantitative regime alignment.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-ghost-textMuted py-8">
          <Clock className="w-8 h-8 mb-3 opacity-20" />
          <p>No active setup at this time.</p>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        {(isLong || isShort) && (
          <button className="flex-1 py-2.5 bg-ghost-cyan text-slate-900 font-semibold rounded-lg hover:bg-cyan-400 transition-colors">
            View setup
          </button>
        )}
        <button 
          onClick={() => setShowAnalysis(!showAnalysis)}
          className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${showAnalysis ? 'bg-ghost-border border-ghost-border text-ghost-textPrimary' : 'border-ghost-border text-ghost-textPrimary hover:bg-ghost-border/40'}`}
        >
          {showAnalysis ? 'Hide analysis' : 'View analysis'}
        </button>
      </div>

      {showAnalysis && (
        <div className="mt-4 pt-4 border-t border-ghost-border/40 animate-in fade-in slide-in-from-top-2">
          <div className="text-xs uppercase tracking-wider text-ghost-textDim font-semibold mb-3">Quantitative Consensus</div>
          <div className="space-y-2">
            {signal.strategy_signals.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded bg-ghost-darkest/50">
                <span className="text-sm text-ghost-textMuted">{s.strategy_name.replace(/_/g, ' ')}</span>
                <span className={`text-xs font-bold uppercase ${s.direction === 'LONG' ? 'text-emerald-400' : s.direction === 'SHORT' ? 'text-rose-400' : 'text-ghost-textDim'}`}>
                  {s.direction}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const Signals: React.FC = () => {
  const { profile } = useProfile();
  const [activeFilter, setActiveFilter] = useState<'All' | 'My Markets' | 'Potential setups'>('My Markets');
  
  const [signals, setSignals] = useState<Record<string, AggregatedSignalResult>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Default symbols to display if profile has none or 'All' is selected
  const defaultSymbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT'];
  
  useEffect(() => {
    let symbolsToFetch = defaultSymbols;
    
    if (activeFilter === 'My Markets' && profile?.markets && profile.markets.length > 0) {
      symbolsToFetch = profile.markets.map(m => m.includes('/') ? m : `${m}/USDT`);
    }

    const fetchAll = async () => {
      setIsLoading(true);
      const results: Record<string, AggregatedSignalResult> = {};
      
      await Promise.all(symbolsToFetch.map(async (sym) => {
        try {
          const res = await signalsApi.getAssetSignal(sym, '1h', 1);
          results[sym] = res.data;
        } catch (e) {
          // ignore failures for individual assets
        }
      }));
      
      setSignals(results);
      setIsLoading(false);
    };

    fetchAll();
  }, [activeFilter, profile]);

  const filteredSymbols = Object.keys(signals).filter(sym => {
    if (activeFilter === 'Potential setups') {
      return signals[sym].direction !== 'NEUTRAL';
    }
    return true;
  });

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">Signals</h1>
        <p className="text-sm text-ghost-textMuted mt-1">
          Trading setups generated from your quantitative consensus engines.
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-2 border-b border-ghost-border/50 pb-px">
        {['All', 'My Markets', 'Potential setups'].map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-[1px] ${
              activeFilter === filter
                ? 'border-ghost-cyan text-ghost-cyan'
                : 'border-transparent text-ghost-textMuted hover:text-ghost-textPrimary hover:border-ghost-border'
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-ghost-textMuted">
          <div className="w-8 h-8 border-2 border-ghost-cyan border-t-transparent rounded-full animate-spin mb-4" />
          <p>Analyzing market setups...</p>
        </div>
      ) : filteredSymbols.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 bg-ghost-card border border-ghost-border border-dashed rounded-2xl">
          <Zap className="w-8 h-8 text-ghost-textDim mb-3" />
          <p className="text-ghost-textMuted">There aren't any matching setups right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredSymbols.map(sym => (
            <SignalCard key={sym} symbol={sym} signal={signals[sym]} />
          ))}
        </div>
      )}
    </div>
  );
};
