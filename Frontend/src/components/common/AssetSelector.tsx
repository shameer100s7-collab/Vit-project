import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import {
  MarketDefinition,
  CORE_MARKET_UNIVERSE,
  getCachedMarketUniverse,
  fetchMarketUniverse,
  formatDisplaySymbol,
  normalizeSymbol,
} from '../../services/marketUniverse';

interface AssetSelectorProps {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  availableSymbols?: string[];
  disabled?: boolean;
}

export const AssetSelector: React.FC<AssetSelectorProps> = ({
  selectedSymbol,
  onSelectSymbol,
  availableSymbols,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [universe, setUniverse] = useState<MarketDefinition[]>(() => getCachedMarketUniverse() || CORE_MARKET_UNIVERSE);

  useEffect(() => {
    let isMounted = true;
    fetchMarketUniverse().then((discovered) => {
      if (isMounted && discovered.length > 0) {
        setUniverse(discovered);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const displaySelected = useMemo(() => {
    return formatDisplaySymbol(selectedSymbol);
  }, [selectedSymbol]);

  // Filter pairs by ticker or friendly name
  const filteredMarkets = useMemo(() => {
    if (availableSymbols && availableSymbols.length > 0) {
      const allowedSet = new Set(availableSymbols.map(normalizeSymbol));
      return universe.filter((m) => allowedSet.has(m.symbol));
    }

    if (!searchQuery.trim()) {
      return universe;
    }

    const q = searchQuery.toLowerCase().replace(/[\/\-_]/g, '');
    return universe.filter(
      (m) =>
        m.symbol.toLowerCase().includes(q) ||
        m.baseAsset.toLowerCase().includes(q) ||
        m.displaySymbol.toLowerCase().includes(q) ||
        (m.name && m.name.toLowerCase().includes(q))
    );
  }, [universe, availableSymbols, searchQuery]);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQuery.trim().toUpperCase();
    if (clean) {
      const formatted = clean.includes('/') ? clean : `${clean}/USDT`;
      onSelectSymbol(formatted);
      setSearchQuery('');
      setIsOpen(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between gap-2.5 px-3.5 py-1.5 bg-ghost-card border border-ghost-border rounded-xl text-xs font-bold text-ghost-textPrimary hover:border-ghost-sand/60 hover:bg-ghost-cardHover transition-colors focus:outline-none disabled:opacity-50 shadow-xs"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="font-mono text-ghost-sand">{displaySelected}</span>
        <ChevronDown className="w-3.5 h-3.5 text-ghost-textMuted" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-72 rounded-2xl bg-ghost-card border border-ghost-border shadow-2xl z-50 py-2 text-xs overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input Bar */}
            <div className="px-3 pb-2 border-b border-ghost-border/60">
              <form onSubmit={handleCustomSubmit} className="flex items-center gap-2 bg-ghost-bg px-2.5 py-1.5 rounded-xl border border-ghost-border">
                <Search className="w-3.5 h-3.5 text-ghost-textMuted shrink-0" />
                <input
                  type="text"
                  placeholder="Search coin (e.g. BTC, Solana)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none text-xs text-ghost-textPrimary placeholder:text-ghost-textDim focus:outline-none"
                  autoFocus
                />
              </form>
            </div>

            {/* Pairs List */}
            <div className="max-h-60 overflow-y-auto py-1 divide-y divide-ghost-border/20">
              {filteredMarkets.length > 0 ? (
                filteredMarkets.slice(0, 40).map((m) => {
                  const isSelected = normalizeSymbol(selectedSymbol) === m.symbol;
                  return (
                    <button
                      key={m.symbol}
                      type="button"
                      onClick={() => {
                        onSelectSymbol(m.displaySymbol);
                        setIsOpen(false);
                        setSearchQuery('');
                      }}
                      className={`w-full text-left px-3.5 py-2.5 hover:bg-ghost-cardHover flex items-center justify-between transition-colors ${
                        isSelected ? 'bg-ghost-burgundy/30 text-ghost-sand font-bold' : 'text-ghost-textPrimary'
                      }`}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs">{m.displaySymbol}</span>
                          <span className="text-[10px] text-ghost-textMuted font-normal">{m.name}</span>
                        </div>
                        <span className="text-[10px] text-ghost-textMuted font-mono">Binance Spot</span>
                      </div>

                      {isSelected ? (
                        <Check className="w-4 h-4 text-ghost-sand shrink-0" />
                      ) : (
                        <span className="text-[10px] text-ghost-textMuted font-mono uppercase">{m.quoteAsset}</span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-4 text-center text-ghost-textMuted space-y-1">
                  <p>No supported market found.</p>
                  <button
                    type="button"
                    onClick={handleCustomSubmit}
                    className="text-ghost-sand hover:underline text-[11px] font-semibold"
                  >
                    Use "{searchQuery.toUpperCase()}/USDT"
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
