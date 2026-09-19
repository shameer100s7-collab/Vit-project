import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  TrendingUp,
  Zap,
  ShieldCheck,
  PieChart,
  BookOpen,
  Scale,
  ArrowRight,
  X,
} from 'lucide-react';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else {
          // Trigger handled in parent or here
        }
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const items = useMemo(
    () => [
      { id: 'overview', title: 'Overview', desc: 'Portfolio dashboard and tracked markets', path: '/', icon: LayoutDashboard },
      { id: 'markets', title: 'Markets', desc: 'Live exchange prices, order book & depth', path: '/market', icon: TrendingUp },
      { id: 'signals', title: 'Signals', desc: 'Evidence-based market context & chart vision', path: '/signals', icon: Zap },
      { id: 'strategies', title: 'Strategies', desc: 'On-chain verified strategy registry & backtests', path: '/strategies', icon: ShieldCheck },
      { id: 'portfolio', title: 'Portfolio', desc: 'Track holdings, wallets & risk exposure', path: '/portfolio-risk', icon: PieChart },
      { id: 'research', title: 'Research', desc: 'Market outlook, behavior & optimization', path: '/research', icon: BookOpen },
      { id: 'courtroom', title: 'Courtroom', desc: 'Challenge and stress-test your market thesis', path: '/courtroom', icon: Scale },
      { id: 'btc', title: 'BTC / USDT', desc: 'Bitcoin live Binance spot market', path: '/market', icon: TrendingUp },
      { id: 'eth', title: 'ETH / USDT', desc: 'Ethereum live Binance spot market', path: '/market', icon: TrendingUp },
      { id: 'sol', title: 'SOL / USDT', desc: 'Solana live Binance spot market', path: '/market', icon: TrendingUp },
    ],
    []
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return items.slice(0, 7);
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.desc.toLowerCase().includes(query.toLowerCase())
    );
  }, [items, query]);

  if (!isOpen) return null;

  const handleSelect = (path: string) => {
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-4 sm:p-6 md:p-20 flex items-start justify-center">
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
      />

      <div className="relative w-full max-w-xl bg-ghost-card border border-ghost-border rounded-2xl shadow-2xl overflow-hidden z-10 space-y-2">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-ghost-border/70">
          <Search className="w-4 h-4 text-ghost-textMuted mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Search markets, signals, strategies, or research..."
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-ghost-textPrimary placeholder:text-ghost-textMuted/60 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-ghost-textMuted hover:text-ghost-textPrimary ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 text-xs">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-ghost-textMuted text-xs">
              No matching pages or markets found for "{query}"
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item.path)}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-ghost-cardHover border border-transparent hover:border-ghost-border/50 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-ghost-bg border border-ghost-border/40 text-ghost-sand">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-ghost-textPrimary group-hover:text-ghost-sand transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-ghost-textMuted leading-none mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-ghost-textMuted group-hover:text-ghost-sand opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-ghost-darkest/60 border-t border-ghost-border/40 text-[10px] text-ghost-textMuted flex items-center justify-between">
          <span>Navigate with arrows or click</span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>
  );
};
