import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useLivePrice } from '../../hooks/useLivePrice';

interface WatchlistItemProps {
  symbol: string;
  onRemove: (symbol: string) => void;
  onClick: (symbol: string) => void;
}

const WatchlistItem: React.FC<WatchlistItemProps> = ({ symbol, onRemove, onClick }) => {
  const livePrice = useLivePrice(symbol);
  
  return (
    <div 
      className="flex items-center justify-between p-3.5 bg-ghost-darkest/70 border border-ghost-border/50 rounded-xl hover:border-ghost-sand/60 transition-colors cursor-pointer group"
      onClick={() => onClick(symbol)}
    >
      <span className="font-bold text-ghost-textPrimary text-sm tracking-wide">{symbol}</span>
      <div className="flex items-center gap-3">
        <span className="font-bold text-ghost-sand text-sm">
          {livePrice ? `$${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '---'}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(symbol);
          }}
          className="p-1 text-ghost-textMuted hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
          title="Remove from Watchlist"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

interface WatchlistProps {
  onSelectSymbol: (symbol: string) => void;
}

export const Watchlist: React.FC<WatchlistProps> = ({ onSelectSymbol }) => {
  const [symbols, setSymbols] = useState<string[]>(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);
  const [newSymbol, setNewSymbol] = useState('');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    const formatted = newSymbol.trim().toUpperCase();
    if (!symbols.includes(formatted)) {
      setSymbols([...symbols, formatted]);
    }
    setNewSymbol('');
  };

  const handleRemove = (symbol: string) => {
    setSymbols(symbols.filter(s => s !== symbol));
  };

  return (
    <div className="bg-ghost-card border border-ghost-border rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
        <h2 className="text-sm font-bold text-ghost-textPrimary tracking-tight">My Markets</h2>
      </div>

      <div className="space-y-2">
        {symbols.map(sym => (
          <WatchlistItem 
            key={sym} 
            symbol={sym} 
            onRemove={handleRemove} 
            onClick={onSelectSymbol} 
          />
        ))}
        {symbols.length === 0 && (
          <p className="text-xs text-ghost-textMuted py-2 text-center">Watchlist is empty</p>
        )}
      </div>

      <form onSubmit={handleAdd} className="pt-2 flex items-center gap-2">
        <input
          type="text"
          placeholder="Add asset (e.g. ADA/USDT)"
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          className="flex-1 bg-ghost-darkest border border-ghost-border rounded-xl px-3 py-2 text-xs text-ghost-textPrimary placeholder:text-ghost-textDim focus:outline-none focus:border-ghost-burgundySoft transition-colors"
        />
        <button
          type="submit"
          className="p-2 bg-ghost-burgundy border border-ghost-burgundyLight hover:bg-ghost-burgundyLight rounded-xl text-ghost-sand transition-colors shadow"
          title="Add to Watchlist"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
