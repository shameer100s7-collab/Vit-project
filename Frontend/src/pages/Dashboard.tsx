import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { signalsApi, balanceService, BalanceItem } from '../api';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useLivePrice } from '../hooks/useLivePrice';
import { Watchlist } from '../components/common/Watchlist';
import { AggregatedSignalResult } from '../types';
import { Zap, ShieldAlert, ArrowRight, Wallet } from 'lucide-react';

const PortfolioValue: React.FC<{ balances: BalanceItem[] }> = ({ balances }) => {
  const btcPrice = useLivePrice('BTC/USDT');
  const ethPrice = useLivePrice('ETH/USDT');
  const solPrice = useLivePrice('SOL/USDT');

  const value = useMemo(() => {
    let total = 0;
    balances.forEach(b => {
      const sym = b.symbol.toUpperCase();
      if (sym.includes('BTC') && btcPrice) total += btcPrice * b.quantity;
      else if (sym.includes('ETH') && ethPrice) total += ethPrice * b.quantity;
      else if (sym.includes('SOL') && solPrice) total += solPrice * b.quantity;
      else if (sym.includes('USDT')) total += b.quantity;
    });
    return total;
  }, [balances, btcPrice, ethPrice, solPrice]);

  return (
    <div className="bg-ghost-card border border-ghost-border rounded-2xl p-6 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-ghost-sand">
        <Wallet className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-wider text-ghost-textMuted">Portfolio Value</span>
      </div>
      <div className="flex items-baseline gap-3">
        <h2 className="text-3xl sm:text-4xl font-extrabold text-ghost-sand tracking-tight">
          ${value > 0 ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
        </h2>
        {value > 0 && <span className="text-emerald-400 text-sm font-semibold">+2.4% today</span>}
      </div>
    </div>
  );
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>(profile?.markets?.[0] ? `${profile.markets[0]}/USDT` : 'BTC/USDT');
  const [signal, setSignal] = useState<AggregatedSignalResult | null>(null);

  useEffect(() => {
    balanceService.getBalances().then(setBalances).catch(() => setBalances([]));
  }, []);

  useEffect(() => {
    signalsApi.getAssetSignal(selectedSymbol)
      .then((res: any) => setSignal(res.data))
      .catch(() => setSignal(null));
  }, [selectedSymbol]);

  // Risk Logic
  const dailyRiskLimit = (profile?.capital || 10000) * ((profile?.dailyLossLimit || 2) / 100);
  const plannedRisk = (profile?.capital || 10000) * ((profile?.riskPerTrade || 1) / 100);
  const riskProgress = Math.min((plannedRisk / dailyRiskLimit) * 100, 100);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ghost-textPrimary">
          Good {new Date().getHours() < 12 ? 'morning' : 'evening'}, {user?.email?.split('@')[0] || 'Trader'}
        </h1>
        <p className="text-xs text-ghost-textMuted mt-1">Here is what's happening across your tracked markets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Portfolio & Watchlist */}
        <div className="lg:col-span-2 space-y-6">
          <PortfolioValue balances={balances} />
          
          <Watchlist onSelectSymbol={setSelectedSymbol} />
        </div>

        {/* Right Column: Signals & Risk */}
        <div className="space-y-6">
          
          {/* Signal Card */}
          <div className="bg-ghost-card border border-ghost-border rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-ghost-border/50">
              <div className="flex items-center gap-2 text-ghost-sand font-bold text-sm">
                <Zap className="w-4 h-4 text-ghost-sand" />
                <span>{selectedSymbol} Context</span>
              </div>
              {signal?.direction === 'LONG' && <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-lg text-xs font-semibold">Bullish bias</span>}
              {signal?.direction === 'SHORT' && <span className="bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2.5 py-0.5 rounded-lg text-xs font-semibold">Bearish bias</span>}
              {signal?.direction === 'NEUTRAL' && <span className="bg-ghost-border text-ghost-textMuted px-2.5 py-0.5 rounded-lg text-xs font-semibold">Neutral</span>}
            </div>

            {signal ? (
              <div className="space-y-3.5 flex-1">
                <div className="flex justify-between items-baseline border-b border-ghost-border/40 pb-2.5 text-xs">
                  <span className="text-ghost-textMuted">Suggested Entry</span>
                  <span className="text-ghost-textPrimary font-semibold">Market Order</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-ghost-border/40 pb-2.5 text-xs">
                  <span className="text-ghost-textMuted">Risk / Reward</span>
                  <span className="text-ghost-textPrimary font-semibold">{profile?.riskRewardPreference || '1 : 2'}</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-ghost-border/40 pb-2.5 text-xs">
                  <span className="text-ghost-textMuted">Planned Risk</span>
                  <span className="text-ghost-sand font-bold">${plannedRisk.toLocaleString()}</span>
                </div>
                
                <div className="pt-1">
                  <p className="text-xs text-ghost-textMuted leading-relaxed">
                    {Math.round(signal.consensus_metrics.agreement_ratio * signal.consensus_metrics.strategies_evaluated)} factors currently support this market context based on price action and momentum.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-ghost-textMuted py-8">
                Evaluating market context...
              </div>
            )}

            <button 
              onClick={() => navigate('/signals')}
              className="w-full mt-6 py-2.5 rounded-xl bg-ghost-burgundy text-ghost-sand hover:bg-ghost-burgundyLight transition-colors text-xs font-semibold flex items-center justify-center gap-2 shadow"
            >
              <span>View analysis</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Risk Card */}
          <div className="bg-ghost-card border border-ghost-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-ghost-textPrimary font-bold text-sm mb-6 pb-3 border-b border-ghost-border/50">
              <ShieldAlert className="w-4 h-4 text-amber-300" />
              <span>Your Risk Today</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-2xl font-bold text-ghost-sand">${plannedRisk.toLocaleString()}</span>
                <span className="text-xs text-ghost-textMuted mb-0.5">of ${dailyRiskLimit.toLocaleString()} limit</span>
              </div>
              
              <div className="h-2 bg-ghost-darkest rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-300 ${riskProgress > 80 ? 'bg-rose-500' : riskProgress > 50 ? 'bg-amber-400' : 'bg-ghost-sand'}`}
                  style={{ width: `${riskProgress}%` }}
                />
              </div>
              
              <p className="text-xs text-ghost-textMuted leading-relaxed pt-1">
                You have approximately <strong className="text-ghost-textPrimary">${(dailyRiskLimit - plannedRisk).toLocaleString()}</strong> of your planned daily risk limit remaining.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
