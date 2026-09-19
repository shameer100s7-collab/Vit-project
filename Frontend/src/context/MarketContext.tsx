import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  MarketDefinition,
  NormalizedMarketSnapshot,
  CORE_MARKET_UNIVERSE,
  normalizeSymbol,
  formatDisplaySymbol,
  fetchMarketUniverse,
} from '../services/marketUniverse';
import { livePriceService, LiveTickerPayload } from '../api/livePriceService';

interface MarketContextType {
  markets: MarketDefinition[];
  selectedSymbol: string;
  selectedDisplaySymbol: string;
  setSelectedSymbol: (symbol: string) => void;
  liveSnapshots: Record<string, NormalizedMarketSnapshot>;
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;
  toggleWatchlist: (symbol: string) => void;
  isWatchlisted: (symbol: string) => boolean;
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  getLivePrice: (symbol: string) => number | null;
  getSnapshot: (symbol: string) => NormalizedMarketSnapshot | undefined;
}

const MarketContext = createContext<MarketContextType | undefined>(undefined);

const WATCHLIST_STORAGE_KEY = 'ghost_market_watchlist_v1';
const DEFAULT_WATCHLIST = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];

export const MarketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [markets, setMarkets] = useState<MarketDefinition[]>(CORE_MARKET_UNIVERSE);
  const [selectedSymbol, setSelectedSymbolState] = useState<string>('BTCUSDT');
  const [liveSnapshots, setLiveSnapshots] = useState<Record<string, NormalizedMarketSnapshot>>({});
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');

  // User Watchlist stored in localStorage
  const [watchlist, setWatchlist] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeSymbol);
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_WATCHLIST;
  });

  const setSelectedSymbol = useCallback((symbol: string) => {
    const canonical = normalizeSymbol(symbol);
    setSelectedSymbolState(canonical);
  }, []);

  const selectedDisplaySymbol = useMemo(() => {
    return formatDisplaySymbol(selectedSymbol);
  }, [selectedSymbol]);

  // Load dynamically discovered exchange universe on mount
  useEffect(() => {
    let isMounted = true;
    fetchMarketUniverse().then((discovered) => {
      if (isMounted && discovered.length > 0) {
        setMarkets(discovered);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Save watchlist to localStorage
  const saveWatchlist = useCallback((newList: string[]) => {
    setWatchlist(newList);
    try {
      localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(newList));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const addToWatchlist = useCallback(
    (symbol: string) => {
      const canonical = normalizeSymbol(symbol);
      if (!watchlist.includes(canonical)) {
        saveWatchlist([...watchlist, canonical]);
      }
    },
    [watchlist, saveWatchlist]
  );

  const removeFromWatchlist = useCallback(
    (symbol: string) => {
      const canonical = normalizeSymbol(symbol);
      saveWatchlist(watchlist.filter((s) => s !== canonical));
    },
    [watchlist, saveWatchlist]
  );

  const isWatchlisted = useCallback(
    (symbol: string) => {
      return watchlist.includes(normalizeSymbol(symbol));
    },
    [watchlist]
  );

  const toggleWatchlist = useCallback(
    (symbol: string) => {
      const canonical = normalizeSymbol(symbol);
      if (watchlist.includes(canonical)) {
        removeFromWatchlist(canonical);
      } else {
        addToWatchlist(canonical);
      }
    },
    [watchlist, addToWatchlist, removeFromWatchlist]
  );

  // Active streaming symbols: all watchlisted symbols + currently selected symbol
  const activeStreamSymbols = useMemo(() => {
    const set = new Set<string>(watchlist);
    set.add(selectedSymbol);
    return Array.from(set);
  }, [watchlist, selectedSymbol]);

  // Keep a ref of activeStreamSymbols to avoid recreating callbacks
  const activeStreamSymbolsRef = useRef(activeStreamSymbols);
  activeStreamSymbolsRef.current = activeStreamSymbols;

  // Single Shared WebSocket subscription management
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    activeStreamSymbols.forEach((sym) => {
      const unsub = livePriceService.subscribeTicker(sym, (ticker: LiveTickerPayload) => {
        const canonical = normalizeSymbol(ticker.symbol);
        const now = Date.now();

        setLiveSnapshots((prev) => ({
          ...prev,
          [canonical]: {
            symbol: canonical,
            displaySymbol: formatDisplaySymbol(canonical),
            price: ticker.price,
            priceChange24h: ticker.change24h,
            priceChangePercent24h: ticker.changePercent24h,
            high24h: ticker.high24h,
            low24h: ticker.low24h,
            volume24h: ticker.volume24h,
            quoteVolume24h: ticker.quoteVolume24h,
            bestBid: ticker.bestBid,
            bestAsk: ticker.bestAsk,
            tradesCount24h: ticker.tradesCount24h,
            eventTime: ticker.eventTime,
            receivedAt: now,
            source: 'Binance Spot',
            freshness: 'LIVE',
          },
        }));
        setConnectionStatus('connected');
      });

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [activeStreamSymbols]);

  // Freshness check: if a snapshot hasn't received ticks in > 15s, mark as STALE
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setLiveSnapshots((prev) => {
        let changed = false;
        const next = { ...prev };

        Object.keys(next).forEach((sym) => {
          const snap = next[sym];
          if (snap && snap.freshness === 'LIVE' && now - snap.receivedAt > 15000) {
            next[sym] = { ...snap, freshness: 'STALE' };
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getLivePrice = useCallback(
    (symbol: string): number | null => {
      const canonical = normalizeSymbol(symbol);
      return liveSnapshots[canonical]?.price ?? null;
    },
    [liveSnapshots]
  );

  const getSnapshot = useCallback(
    (symbol: string): NormalizedMarketSnapshot | undefined => {
      const canonical = normalizeSymbol(symbol);
      return liveSnapshots[canonical];
    },
    [liveSnapshots]
  );

  const value = useMemo(
    () => ({
      markets,
      selectedSymbol,
      selectedDisplaySymbol,
      setSelectedSymbol,
      liveSnapshots,
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      toggleWatchlist,
      isWatchlisted,
      connectionStatus,
      getLivePrice,
      getSnapshot,
    }),
    [
      markets,
      selectedSymbol,
      selectedDisplaySymbol,
      setSelectedSymbol,
      liveSnapshots,
      watchlist,
      addToWatchlist,
      removeFromWatchlist,
      toggleWatchlist,
      isWatchlisted,
      connectionStatus,
      getLivePrice,
      getSnapshot,
    ]
  );

  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
};

export const useMarket = (): MarketContextType => {
  const ctx = useContext(MarketContext);
  if (!ctx) {
    return {
      markets: CORE_MARKET_UNIVERSE,
      selectedSymbol: 'BTCUSDT',
      selectedDisplaySymbol: 'BTC/USDT',
      setSelectedSymbol: () => {},
      liveSnapshots: {},
      watchlist: DEFAULT_WATCHLIST,
      addToWatchlist: () => {},
      removeFromWatchlist: () => {},
      toggleWatchlist: () => {},
      isWatchlisted: (s) => DEFAULT_WATCHLIST.includes(normalizeSymbol(s)),
      connectionStatus: 'connected',
      getLivePrice: () => null,
      getSnapshot: () => undefined,
    };
  }
  return ctx;
};
