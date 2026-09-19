/**
 * GHOST — Centralized Real-Time Market Universe
 * Single Source of Truth for all cryptocurrency pairs across GHOST.
 */

import { marketApi } from '../api/market';

export interface MarketDefinition {
  symbol: string; // Canonical representation e.g. "BTCUSDT"
  displaySymbol: string; // Human-friendly display e.g. "BTC/USDT"
  baseAsset: string; // e.g. "BTC"
  quoteAsset: string; // e.g. "USDT"
  wsStream: string; // Lowercase for Binance WebSocket e.g. "btcusdt"
  status: 'TRADING' | 'HALTED' | 'BREAK';
  pricePrecision: number;
  quantityPrecision: number;
  minOrderQuantity: number;
  name: string; // Friendly asset name e.g. "Bitcoin"
}

export interface NormalizedMarketSnapshot {
  symbol: string; // Canonical "BTCUSDT"
  displaySymbol: string; // "BTC/USDT"
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  bestBid?: number;
  bestAsk?: number;
  tradesCount24h?: number;
  eventTime: number; // ms
  receivedAt: number; // ms
  source: string; // "Binance Spot"
  freshness: 'LIVE' | 'STALE' | 'UNAVAILABLE';
}

/**
 * Authoritative baseline supported market universe.
 * Priority-ordered crypto majors.
 */
export const CORE_MARKET_UNIVERSE: MarketDefinition[] = [
  {
    symbol: 'BTCUSDT',
    displaySymbol: 'BTC/USDT',
    baseAsset: 'BTC',
    quoteAsset: 'USDT',
    wsStream: 'btcusdt',
    status: 'TRADING',
    pricePrecision: 2,
    quantityPrecision: 5,
    minOrderQuantity: 0.00001,
    name: 'Bitcoin',
  },
  {
    symbol: 'ETHUSDT',
    displaySymbol: 'ETH/USDT',
    baseAsset: 'ETH',
    quoteAsset: 'USDT',
    wsStream: 'ethusdt',
    status: 'TRADING',
    pricePrecision: 2,
    quantityPrecision: 4,
    minOrderQuantity: 0.0001,
    name: 'Ethereum',
  },
  {
    symbol: 'SOLUSDT',
    displaySymbol: 'SOL/USDT',
    baseAsset: 'SOL',
    quoteAsset: 'USDT',
    wsStream: 'solusdt',
    status: 'TRADING',
    pricePrecision: 2,
    quantityPrecision: 2,
    minOrderQuantity: 0.01,
    name: 'Solana',
  },
  {
    symbol: 'BNBUSDT',
    displaySymbol: 'BNB/USDT',
    baseAsset: 'BNB',
    quoteAsset: 'USDT',
    wsStream: 'bnbusdt',
    status: 'TRADING',
    pricePrecision: 2,
    quantityPrecision: 3,
    minOrderQuantity: 0.001,
    name: 'BNB',
  },
  {
    symbol: 'XRPUSDT',
    displaySymbol: 'XRP/USDT',
    baseAsset: 'XRP',
    quoteAsset: 'USDT',
    wsStream: 'xrpusdt',
    status: 'TRADING',
    pricePrecision: 4,
    quantityPrecision: 1,
    minOrderQuantity: 0.1,
    name: 'XRP',
  },
  {
    symbol: 'ADAUSDT',
    displaySymbol: 'ADA/USDT',
    baseAsset: 'ADA',
    quoteAsset: 'USDT',
    wsStream: 'adausdt',
    status: 'TRADING',
    pricePrecision: 4,
    quantityPrecision: 1,
    minOrderQuantity: 0.1,
    name: 'Cardano',
  },
  {
    symbol: 'DOGEUSDT',
    displaySymbol: 'DOGE/USDT',
    baseAsset: 'DOGE',
    quoteAsset: 'USDT',
    wsStream: 'dogeusdt',
    status: 'TRADING',
    pricePrecision: 5,
    quantityPrecision: 0,
    minOrderQuantity: 1.0,
    name: 'Dogecoin',
  },
  {
    symbol: 'AVAXUSDT',
    displaySymbol: 'AVAX/USDT',
    baseAsset: 'AVAX',
    quoteAsset: 'USDT',
    wsStream: 'avaxusdt',
    status: 'TRADING',
    pricePrecision: 2,
    quantityPrecision: 2,
    minOrderQuantity: 0.01,
    name: 'Avalanche',
  },
  {
    symbol: 'LINKUSDT',
    displaySymbol: 'LINK/USDT',
    baseAsset: 'LINK',
    quoteAsset: 'USDT',
    wsStream: 'linkusdt',
    status: 'TRADING',
    pricePrecision: 3,
    quantityPrecision: 2,
    minOrderQuantity: 0.01,
    name: 'Chainlink',
  },
  {
    symbol: 'DOTUSDT',
    displaySymbol: 'DOT/USDT',
    baseAsset: 'DOT',
    quoteAsset: 'USDT',
    wsStream: 'dotusdt',
    status: 'TRADING',
    pricePrecision: 3,
    quantityPrecision: 2,
    minOrderQuantity: 0.01,
    name: 'Polkadot',
  },
  {
    symbol: 'NEARUSDT',
    displaySymbol: 'NEAR/USDT',
    baseAsset: 'NEAR',
    quoteAsset: 'USDT',
    wsStream: 'nearusdt',
    status: 'TRADING',
    pricePrecision: 3,
    quantityPrecision: 1,
    minOrderQuantity: 0.1,
    name: 'NEAR Protocol',
  },
  {
    symbol: 'SUIUSDT',
    displaySymbol: 'SUI/USDT',
    baseAsset: 'SUI',
    quoteAsset: 'USDT',
    wsStream: 'suiusdt',
    status: 'TRADING',
    pricePrecision: 4,
    quantityPrecision: 1,
    minOrderQuantity: 0.1,
    name: 'Sui',
  },
  {
    symbol: 'LTCUSDT',
    displaySymbol: 'LTC/USDT',
    baseAsset: 'LTC',
    quoteAsset: 'USDT',
    wsStream: 'ltcusdt',
    status: 'TRADING',
    pricePrecision: 2,
    quantityPrecision: 3,
    minOrderQuantity: 0.001,
    name: 'Litecoin',
  },
  {
    symbol: 'POLUSDT',
    displaySymbol: 'POL/USDT',
    baseAsset: 'POL',
    quoteAsset: 'USDT',
    wsStream: 'polusdt',
    status: 'TRADING',
    pricePrecision: 4,
    quantityPrecision: 1,
    minOrderQuantity: 0.1,
    name: 'Polygon Ecosystem Token',
  },
  {
    symbol: 'UNIUSDT',
    displaySymbol: 'UNI/USDT',
    baseAsset: 'UNI',
    quoteAsset: 'USDT',
    wsStream: 'uniusdt',
    status: 'TRADING',
    pricePrecision: 3,
    quantityPrecision: 2,
    minOrderQuantity: 0.01,
    name: 'Uniswap',
  },
];

const WELL_KNOWN_NAMES: Record<string, string> = {
  BTC: 'Bitcoin',
  ETH: 'Ethereum',
  SOL: 'Solana',
  BNB: 'BNB',
  XRP: 'XRP',
  ADA: 'Cardano',
  DOGE: 'Dogecoin',
  AVAX: 'Avalanche',
  LINK: 'Chainlink',
  DOT: 'Polkadot',
  NEAR: 'NEAR Protocol',
  SUI: 'Sui',
  LTC: 'Litecoin',
  POL: 'Polygon Ecosystem Token',
  MATIC: 'Polygon',
  UNI: 'Uniswap',
};

// In-memory cache for discovered universe
let cachedUniverse: MarketDefinition[] = [...CORE_MARKET_UNIVERSE];
let lastDiscoveryTime = 0;

/**
 * Normalizes any symbol variation to canonical format (e.g. "BTC/USDT" -> "BTCUSDT").
 */
export function normalizeSymbol(rawSymbol: string): string {
  if (!rawSymbol) return 'BTCUSDT';
  const clean = rawSymbol.trim().toUpperCase().replace(/[\/\-_]/g, '');
  
  // If user only passed base asset e.g. "BTC"
  const validQuotes = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'EUR'];
  if (!validQuotes.some((q) => clean.endsWith(q))) {
    return `${clean}USDT`;
  }
  return clean;
}

/**
 * Formats any symbol to standardized display format (e.g. "BTCUSDT" -> "BTC/USDT").
 */
export function formatDisplaySymbol(rawSymbol: string): string {
  if (!rawSymbol) return 'BTC/USDT';
  const clean = rawSymbol.trim().toUpperCase();
  if (clean.includes('/')) return clean;

  const validQuotes = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'EUR'];
  for (const q of validQuotes) {
    if (clean.endsWith(q) && clean.length > q.length) {
      const base = clean.slice(0, -q.length);
      return `${base}/${q}`;
    }
  }
  return `${clean}/USDT`;
}

/**
 * Normalizes symbol to lowercase stream name for Binance WebSocket (e.g. "btcusdt").
 */
export function toWsSymbol(rawSymbol: string): string {
  return normalizeSymbol(rawSymbol).toLowerCase();
}

/**
 * Parses symbol into base and quote assets.
 */
export function parseSymbol(rawSymbol: string): { baseAsset: string; quoteAsset: string } {
  const norm = normalizeSymbol(rawSymbol);
  const validQuotes = ['USDT', 'USDC', 'FDUSD', 'BUSD', 'EUR'];
  for (const q of validQuotes) {
    if (norm.endsWith(q) && norm.length > q.length) {
      return {
        baseAsset: norm.slice(0, -q.length),
        quoteAsset: q,
      };
    }
  }
  return {
    baseAsset: norm.replace('USDT', ''),
    quoteAsset: 'USDT',
  };
}

/**
 * Finds a MarketDefinition by canonical or display symbol.
 */
export function getMarketDefinition(rawSymbol: string): MarketDefinition | undefined {
  const norm = normalizeSymbol(rawSymbol);
  return cachedUniverse.find((m) => m.symbol === norm);
}

/**
 * Checks if a symbol is supported within the market universe.
 */
export function isSupportedSymbol(rawSymbol: string): boolean {
  const norm = normalizeSymbol(rawSymbol);
  return cachedUniverse.some((m) => m.symbol === norm);
}

/**
 * Dynamically discovers exchange symbols from the authoritative backend endpoint
 * and merges them with the core universe without duplicates.
 */
export async function fetchMarketUniverse(): Promise<MarketDefinition[]> {
  const now = Date.now();
  // Cache for 10 minutes in memory
  if (cachedUniverse.length > CORE_MARKET_UNIVERSE.length && now - lastDiscoveryTime < 600000) {
    return cachedUniverse;
  }

  try {
    const res = await marketApi.getSymbols();
    if (res && res.data && res.data.length > 0) {
      const discoveredMap = new Map<string, MarketDefinition>();

      // Seed with core universe
      CORE_MARKET_UNIVERSE.forEach((m) => discoveredMap.set(m.symbol, m));

      // Merge backend-discovered exchange symbols
      res.data.forEach((item) => {
        const canonical = normalizeSymbol(item.symbol);
        if (!discoveredMap.has(canonical)) {
          const { baseAsset, quoteAsset } = parseSymbol(canonical);
          discoveredMap.set(canonical, {
            symbol: canonical,
            displaySymbol: item.display_symbol || formatDisplaySymbol(canonical),
            baseAsset: item.base_asset || baseAsset,
            quoteAsset: item.quote_asset || quoteAsset,
            wsStream: canonical.toLowerCase(),
            status: 'TRADING',
            pricePrecision: item.price_precision ?? 2,
            quantityPrecision: item.quantity_precision ?? 2,
            minOrderQuantity: item.min_order_quantity ?? 0.001,
            name: WELL_KNOWN_NAMES[item.base_asset || baseAsset] || item.base_asset || baseAsset,
          });
        }
      });

      cachedUniverse = Array.from(discoveredMap.values());
      lastDiscoveryTime = now;
    }
  } catch {
    // Fall back gracefully to core universe
  }

  return cachedUniverse;
}

/**
 * Returns the currently cached market universe synchronously.
 */
export function getCachedMarketUniverse(): MarketDefinition[] {
  return cachedUniverse;
}
