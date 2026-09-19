import React, { useEffect, useState } from 'react';
import { balanceService, BalanceItem } from '../../api/balanceService';
import { useLivePrice } from '../../hooks/useLivePrice';
import { Wallet, AlertCircle } from 'lucide-react';
import { LoadingState } from './LoadingState';

const BalanceRow: React.FC<{ item: BalanceItem }> = ({ item }) => {
  const livePrice = useLivePrice(item.symbol);
  const estimatedValue = livePrice ? livePrice * item.quantity : null;

  return (
    <div className="flex items-center justify-between p-3 bg-ghost-darkest/60 border border-ghost-border/50 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="font-mono font-bold text-ghost-textPrimary">{item.symbol}</span>
        <span className="text-ghost-textMuted text-xs">{item.quantity}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-mono font-bold text-ghost-cyan text-sm">
          {estimatedValue !== null 
            ? `$${estimatedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '---'}
        </span>
        <span className="text-ghost-textDim text-[10px]">
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

  if (isLoading) return <LoadingState message="Loading authenticated balances..." />;
  
  if (error) {
    return (
      <div className="bg-ghost-card border border-rose-500/20 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-rose-400 pb-3 border-b border-rose-500/10">
          <AlertCircle className="w-4 h-4" />
          <h2 className="text-base font-semibold">Error Loading Balances</h2>
        </div>
        <p className="text-xs text-rose-400/80">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
        <h2 className="text-base font-semibold text-ghost-textPrimary flex items-center gap-2">
          <Wallet className="w-4 h-4 text-ghost-cyan" />
          <span>Actual Holdings & Estimated Value</span>
        </h2>
      </div>

      {balances.length === 0 ? (
        <div className="text-center py-6 text-ghost-textMuted text-xs">
          <p>No actual balances found on backend (or endpoint missing).</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map(b => (
            <BalanceRow key={b.symbol} item={b} />
          ))}
        </div>
      )}
    </div>
  );
};
