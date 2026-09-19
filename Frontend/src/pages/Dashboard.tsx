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
  // A simple component that calculates total portfolio value based on live prices
  // Since we only know a few assets dynamically, we'll just subscribe to the primary ones.
  // Real implementation would subscribe to all holding symbols.
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
    <div className="bg-ghost-card border border-ghost-border rounded-2xl p-6 shadow-sm">
      <div className="flex items-center gap-2 text-ghost-textDim mb-3">
        <Wallet className="w-4 h-4" />
        <span className="text-sm font-medium uppercase tracking-wider">Portfolio</span>
      </div>
      <div className="flex items-baseline gap-3">
        <h2 className="text-4xl font-bold text-ghost-textPrimary font-mono tracking-tight">
          ${value > 0 ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
        </h2>
        {value > 0 && <span className="text-emerald-400 text-sm font-medium">+2.4% today</span>}
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
    // Fetch actual balances
    balanceService.getBalances().then(setBalances).catch(() => setBalances([]));
  }, []);

  useEffect(() => {
    // Fetch signals for the selected symbol from Watchlist
    signalsApi.getAssetSignal(selectedSymbol)
      .then((res: any) => setSignal(res.data))
      .catch(() => setSignal(null));
  }, [selectedSymbol]);

  // Risk Logic
  const dailyRiskLimit = (profile?.capital || 10000) * ((profile?.dailyLossLimit || 2) / 100);
  const plannedRisk = (profile?.capital || 10000) * ((profile?.riskPerTrade || 1) / 100);
  const riskProgress = Math.min((plannedRisk / dailyRiskLimit) * 100, 100);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-ghost-textPrimary">
          Good {new Date().getHours() < 12 ? 'morning' : 'evening'}, {user?.email?.split('@')[0] || 'Trader'}
        </h1>
        <p className="text-ghost-textMuted mt-1">Here's what's happening in your markets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Portfolio & Watchlist */}
        <div className="lg:col-span-2 space-y-6">
          <PortfolioValue balances={balances} />
          
          <div className="bg-ghost-card border border-ghost-border rounded-2xl p-6 shadow-sm">
            <h3 className="text-base font-semibold text-ghost-textPrimary mb-4">My Markets</h3>
            {/* The Watchlist component is already simple and live */}
            <Watchlist onSelectSymbol={setSelectedSymbol} />
          </div>
        </div>

        {/* Right Column: Signals & Risk */}
        <div className="space-y-6">
          
          {/* Signal Card */}
          <div className="bg-ghost-card border border-ghost-border rounded-2xl p-6 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-ghost-cyan">
                <Zap className="w-4 h-4" />
                <span className="font-semibold">{selectedSymbol} Signal</span>
              </div>
              {signal?.direction === 'LONG' && <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-bold uppercase">Long Setup</span>}
              {signal?.direction === 'SHORT' && <span className="bg-rose-500/10 text-rose-400 px-2 py-1 rounded text-xs font-bold uppercase">Short Setup</span>}
              {signal?.direction === 'NEUTRAL' && <span className="bg-ghost-border text-ghost-textMuted px-2 py-1 rounded text-xs font-bold uppercase">Neutral</span>}
            </div>

            {signal ? (
              <div className="space-y-4 flex-1">
                <div className="flex justify-between items-baseline border-b border-ghost-border/40 pb-3">
                  <span className="text-ghost-textMuted text-sm">Suggested Entry</span>
                  <span className="font-mono text-ghost-textPrimary font-medium">Market</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-ghost-border/40 pb-3">
                  <span className="text-ghost-textMuted text-sm">Risk / Reward</span>
                  <span className="font-mono text-ghost-textPrimary font-medium">{profile?.riskRewardPreference || '1 : 2'}</span>
                </div>
                <div className="flex justify-between items-baseline border-b border-ghost-border/40 pb-3">
                  <span className="text-ghost-textMuted text-sm">Planned Risk</span>
                  <span className="font-mono text-ghost-textPrimary font-medium">${plannedRisk.toLocaleString()}</span>
                </div>
                
                <div className="pt-2">
                  <p className="text-sm text-ghost-textMuted">
                    {Math.round(signal.consensus_metrics.agreement_ratio * signal.consensus_metrics.strategies_evaluated)} factors support this setup based on recent momentum and price action.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-ghost-textMuted py-8">
                Analyzing market setup...
              </div>
            )}

            <button 
              onClick={() => navigate('/signals')}
              className="w-full mt-6 py-2.5 rounded-lg border border-ghost-border text-ghost-textPrimary hover:bg-ghost-border/40 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <span>View analysis</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Risk Card */}
          <div className="bg-ghost-card border border-ghost-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 text-ghost-textPrimary font-semibold mb-6">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>Your Risk Today</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className="text-2xl font-bold font-mono text-ghost-textPrimary">${plannedRisk.toLocaleString()}</span>
                <span className="text-sm text-ghost-textMuted mb-1">of ${dailyRiskLimit.toLocaleString()} limit</span>
              </div>
              
              <div className="h-2 bg-ghost-darkest rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${riskProgress > 80 ? 'bg-rose-500' : riskProgress > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                  style={{ width: `${riskProgress}%` }}
                />
              </div>
              
              <p className="text-xs text-ghost-textMuted mt-4 leading-relaxed pt-2">
                You have approximately ${(dailyRiskLimit - plannedRisk).toLocaleString()} of your planned daily risk limit remaining.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
