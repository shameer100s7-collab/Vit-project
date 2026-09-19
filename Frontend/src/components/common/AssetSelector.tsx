import React, { useState, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { marketApi } from '../../api/market';

interface AssetSelectorProps {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  availableSymbols?: string[];
  disabled?: boolean;
}

const DEFAULT_SYMBOLS = [
  'BTC/USDT',
  'ETH/USDT',
  'SOL/USDT',
  'BNB/USDT',
  'XRP/USDT',
  'ADA/USDT',
  'AVAX/USDT',
  'LINK/USDT',
  'DOGE/USDT',
];

let cachedDiscoveredSymbols: string[] | null = null;

export const AssetSelector: React.FC<AssetSelectorProps> = ({
  selectedSymbol,
  onSelectSymbol,
  availableSymbols,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [symbols, setSymbols] = useState<string[]>(availableSymbols || cachedDiscoveredSymbols || DEFAULT_SYMBOLS);

  useEffect(() => {
    if (availableSymbols) {
      setSymbols(availableSymbols);
      return;
    }

    if (cachedDiscoveredSymbols) {
      setSymbols(cachedDiscoveredSymbols);
      return;
    }

    let isMounted = true;
    marketApi
      .getSymbols()
      .then((res) => {
        if (isMounted && res.data && res.data.length > 0) {
          const list = res.data.map((item) => item.display_symbol);
          cachedDiscoveredSymbols = list;
          setSymbols(list);
        }
      })
      .catch(() => {
        // Fallback to default symbols on error
      });

    return () => {
      isMounted = false;
    };
  }, [availableSymbols]);

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

  const filteredSymbols = symbols.filter((sym) =>
    sym.toLowerCase().includes(searchQuery.toLowerCase().replace(/[\/\-_]/g, ''))
  );

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center justify-between gap-2 px-3.5 py-1.5 bg-ghost-card border border-ghost-border rounded-xl text-xs font-bold text-ghost-textPrimary hover:border-ghost-sand/60 hover:bg-ghost-cardHover transition-colors focus:outline-none disabled:opacity-50"
      >
        <span className="text-ghost-sand">●</span>
        <span>{selectedSymbol}</span>
        <ChevronDown className="w-3.5 h-3.5 text-ghost-textMuted" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-60 rounded-2xl bg-ghost-card border border-ghost-border shadow-2xl z-30 py-2 text-xs overflow-hidden">
            <div className="px-3 pb-2 border-b border-ghost-border/60">
              <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5 bg-ghost-darkest px-2.5 py-1.5 rounded-xl border border-ghost-border">
                <Search className="w-3.5 h-3.5 text-ghost-textMuted" />
                <input
                  type="text"
                  placeholder="Search pairs (e.g. BTC)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none text-xs text-ghost-textPrimary placeholder:text-ghost-textDim focus:outline-none"
                  autoFocus
                />
              </form>
            </div>

            <div className="max-h-56 overflow-y-auto py-1 divide-y divide-ghost-border/20">
              {filteredSymbols.length > 0 ? (
                filteredSymbols.slice(0, 50).map((sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => {
                      onSelectSymbol(sym);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-ghost-border/50 flex items-center justify-between transition-colors ${
                      sym === selectedSymbol ? 'text-ghost-sand font-bold bg-ghost-burgundy/30' : 'text-ghost-textPrimary'
                    }`}
                  >
                    <span>{sym}</span>
                    {sym === selectedSymbol ? (
                      <span className="text-[10px] text-ghost-sand font-bold">ACTIVE</span>
                    ) : (
                      <span className="text-[10px] text-ghost-textDim font-normal">Binance</span>
                    )}
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-center text-ghost-textMuted">
                  <p>No pair found</p>
                  <button
                    type="button"
                    onClick={handleCustomSubmit}
                    className="mt-1 text-ghost-sand underline text-[11px]"
                  >
                    Select "{searchQuery.toUpperCase()}/USDT"
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
