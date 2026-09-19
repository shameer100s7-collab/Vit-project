import React, { useEffect, useState } from 'react';
import { balanceService, BalanceItem } from '../../api/balanceService';
import { useLivePrice } from '../../hooks/useLivePrice';
import { Wallet, AlertCircle } from 'lucide-react';
import { LoadingState } from './LoadingState';

const BalanceRow: React.FC<{ item: BalanceItem }> = ({ item }) => {
  const livePrice = useLivePrice(item.symbol);
  const estimatedValue = livePrice ? livePrice * item.quantity : null;

  return (
    <div className="flex items-center justify-between p-3.5 bg-ghost-darkest/70 border border-ghost-border/50 rounded-xl">
      <div className="flex items-center gap-3">
        <span className="font-bold text-ghost-textPrimary">{item.symbol}</span>
        <span className="text-ghost-textMuted text-xs">{item.quantity}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-bold text-ghost-sand text-sm">
          {estimatedValue !== null 
            ? `$${estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '---'}
        </span>
        <span className="text-ghost-textDim text-[11px]">
          Price: {livePrice ? `$${livePrice.toLocaleString()}` : '---'}
        </span>
      </div>
    </div>
  );
};

export const ActualBalances: React.FC = () => {
  const [balances, setBalances] = useState<BalanceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalances = async () => {
      try {
        const data = await balanceService.getBalances();
        setBalances(data);
      } catch (err) {
        setError('Failed to fetch authenticated balances.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();
  }, []);

  if (isLoading) return <LoadingState message="Loading your balances..." />;
  
  if (error) {
    return (
      <div className="bg-ghost-card border border-rose-500/20 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-rose-400 pb-3 border-b border-rose-500/10">
          <AlertCircle className="w-4 h-4" />
          <h2 className="text-sm font-bold">Error Loading Balances</h2>
        </div>
        <p className="text-xs text-rose-400/80">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-ghost-card border border-ghost-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-ghost-sand pb-3 border-b border-ghost-border/50">
        <Wallet className="w-4 h-4" />
        <h2 className="text-sm font-bold text-ghost-textPrimary tracking-tight">Connected Wallet Balances</h2>
      </div>

      <div className="space-y-2">
        {balances.map(item => (
          <BalanceRow key={item.symbol} item={item} />
        ))}
        {balances.length === 0 && (
          <p className="text-xs text-ghost-textMuted py-2 text-center">No wallet balances found.</p>
        )}
      </div>
    </div>
  );
};
