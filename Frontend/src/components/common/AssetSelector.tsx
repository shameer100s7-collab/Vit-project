import React, { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface AssetSelectorProps {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  availableSymbols?: string[];
  disabled?: boolean;
}

const DEFAULT_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'ADA/USDT', 'AVAX/USDT'];

export const AssetSelector: React.FC<AssetSelectorProps> = ({
  selectedSymbol,
  onSelectSymbol,
  availableSymbols = DEFAULT_SYMBOLS,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSelectSymbol(customInput.trim().toUpperCase());
      setCustomInput('');
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between gap-2 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg text-xs font-mono font-semibold text-ghost-textPrimary hover:border-ghost-cyan hover:bg-ghost-cardHover transition-colors focus:outline-none focus:ring-1 focus:ring-ghost-cyan disabled:opacity-50"
      >
        <span className="text-ghost-cyan">●</span>
        <span>{selectedSymbol}</span>
        <ChevronDown className="w-3.5 h-3.5 text-ghost-textMuted" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-56 rounded-xl bg-ghost-card border border-ghost-border shadow-2xl z-30 py-2 font-mono text-xs overflow-hidden">
            <div className="px-3 pb-2 border-b border-ghost-border/60">
              <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5 bg-ghost-darkest px-2 py-1 rounded border border-ghost-border">
                <Search className="w-3.5 h-3.5 text-ghost-textMuted" />
                <input
                  type="text"
                  placeholder="Custom symbol (e.g. BTC)..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  className="w-full bg-transparent border-none text-xs text-ghost-textPrimary placeholder:text-ghost-textDim focus:outline-none"
                />
              </form>
            </div>

            <div className="max-h-48 overflow-y-auto py-1">
              {availableSymbols.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => {
                    onSelectSymbol(sym);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 hover:bg-ghost-border/50 flex items-center justify-between transition-colors ${
                    sym === selectedSymbol ? 'text-ghost-cyan font-bold bg-ghost-cyan/10' : 'text-ghost-textPrimary'
                  }`}
                >
                  <span>{sym}</span>
                  {sym === selectedSymbol && <span className="text-[10px] text-ghost-cyan font-bold">ACTIVE</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
