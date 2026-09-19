import { CanonicalCandle, OrderBookLevel } from '../types';

export type PriceCallback = (price: number) => void;

export interface LiveTickerPayload {
  symbol: string;
  price: number;
  changePercent24h: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  quoteVolume24h: number;
  tradesCount24h: number;
  bestBid: number;
  bestAsk: number;
  eventTime: number; // milliseconds
}

export type TickerCallback = (ticker: LiveTickerPayload) => void;

export interface LiveDepthPayload {
  symbol: string;
  lastUpdateId: number;
  last_update_id?: number;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread?: number;
  spread_bps?: number;
  eventTime: number;
}

export type DepthCallback = (depth: LiveDepthPayload) => void;
export type KlineCallback = (candle: CanonicalCandle) => void;

class LivePriceService {
  private ws: WebSocket | null = null;
  private readonly baseUrl = 'wss://stream.binance.com:9443/ws';
  private subscribers: Map<string, Set<PriceCallback>> = new Map();
  private tickerSubscribers: Map<string, Set<TickerCallback>> = new Map();
  private depthSubscribers: Map<string, Set<DepthCallback>> = new Map();
  private klineSubscribers: Map<string, Set<KlineCallback>> = new Map();
  private activeSubscriptions: Set<string> = new Set();

  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 8;
  private isConnecting = false;

  private normalizeSymbol(symbol: string): string {
    // Converts "BTC/USDT" to "btcusdt"
    return symbol.replace(/[\/\-_]/g, '').toLowerCase();
  }

  private connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.baseUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Resubscribe to all active streams
        if (this.activeSubscriptions.size > 0) {
          const params = Array.from(this.activeSubscriptions);
          this.ws?.send(
            JSON.stringify({
              method: 'SUBSCRIBE',
              params,
              id: 1,
            })
          );
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // 1. Binance 24hr Ticker Stream
          if (data.e === '24hrTicker' && data.s && data.c) {
            const rawSymbol = data.s.toLowerCase(); // e.g. "btcusdt"
            const price = parseFloat(data.c);

            // Simple price subscribers
            const priceCallbacks = this.subscribers.get(rawSymbol);
            if (priceCallbacks) {
              priceCallbacks.forEach((cb) => cb(price));
            }

            // Rich ticker subscribers
            const tickerCallbacks = this.tickerSubscribers.get(rawSymbol);
            if (tickerCallbacks) {
              const tickerPayload: LiveTickerPayload = {
                symbol: data.s,
                price: parseFloat(data.c),
                changePercent24h: parseFloat(data.P || '0'),
                change24h: parseFloat(data.p || '0'),
                high24h: parseFloat(data.h || '0'),
                low24h: parseFloat(data.l || '0'),
                volume24h: parseFloat(data.v || '0'),
                quoteVolume24h: parseFloat(data.q || '0'),
                tradesCount24h: parseInt(data.n || '0', 10),
                bestBid: parseFloat(data.b || '0'),
                bestAsk: parseFloat(data.a || '0'),
                eventTime: Number(data.E || Date.now()),
              };
              tickerCallbacks.forEach((cb) => cb(tickerPayload));
            }
          }

          // 2. Binance Depth Stream (@depth20@100ms or @depth)
          if ((data.bids || data.asks) && (data.lastUpdateId || data.E)) {
            // Find matched depth subscriber
            this.depthSubscribers.forEach((callbacks, streamKey) => {
              const rawBids = data.bids || [];
              const rawAsks = data.asks || [];

              let runningBidTotal = 0;
              const bids: OrderBookLevel[] = rawBids.map((b: any) => {
                const p = parseFloat(b[0]);
                const q = parseFloat(b[1]);
                runningBidTotal += q;
                return { price: p, quantity: q, total: runningBidTotal };
              });

              let runningAskTotal = 0;
              const asks: OrderBookLevel[] = rawAsks.map((a: any) => {
                const p = parseFloat(a[0]);
                const q = parseFloat(a[1]);
                runningAskTotal += q;
                return { price: p, quantity: q, total: runningAskTotal };
              });

              const bestBidPrice = bids[0]?.price || 0;
              const bestAskPrice = asks[0]?.price || 0;
              const rawSpread = bestAskPrice > bestBidPrice ? bestAskPrice - bestBidPrice : 0;
              const spreadBps = bestBidPrice > 0 ? (rawSpread / bestBidPrice) * 10000 : 0;

              const depthPayload: LiveDepthPayload = {
                symbol: streamKey,
                lastUpdateId: data.lastUpdateId || 0,
                last_update_id: data.lastUpdateId || 0,
                bids,
                asks,
                spread: rawSpread,
                spread_bps: spreadBps,
                eventTime: Number(data.E || Date.now()),
              };

              callbacks.forEach((cb) => cb(depthPayload));
            });
          }

          // 3. Binance Kline / Candlestick Stream
          if (data.e === 'kline' && data.k) {
            const k = data.k;
            const streamKey = `${k.s.toLowerCase()}@${k.i}`;
            const klineCallbacks = this.klineSubscribers.get(streamKey);

            if (klineCallbacks) {
              const candle: CanonicalCandle = {
                symbol: k.s,
                timeframe: k.i,
                timestamp: new Date(k.t).toISOString(),
                close_time: new Date(k.T).toISOString(),
                open: parseFloat(k.o),
                high: parseFloat(k.h),
                low: parseFloat(k.l),
                close: parseFloat(k.c),
                volume: parseFloat(k.v),
                quote_volume: parseFloat(k.q),
                trades_count: parseInt(k.n, 10),
                source: 'Binance Spot',
              };

              klineCallbacks.forEach((cb) => cb(candle));
            }
          }
        } catch (e) {
          console.error('[LivePriceService] Error parsing WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.ws = null;
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[LivePriceService] WebSocket error:', error);
        this.ws?.close();
      };
    } catch (e) {
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
      this.reconnectAttempts++;

      this.reconnectTimer = setTimeout(() => {
        this.connect();
      }, backoffDelay);
    }
  }

  private sendSubscribe(streamName: string) {
    if (!this.activeSubscriptions.has(streamName)) {
      this.activeSubscriptions.add(streamName);

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            method: 'SUBSCRIBE',
            params: [streamName],
            id: Date.now(),
          })
        );
      } else if (!this.ws && !this.isConnecting) {
        this.connect();
      }
    }
  }

  private sendUnsubscribe(streamName: string) {
    if (this.activeSubscriptions.has(streamName)) {
      this.activeSubscriptions.delete(streamName);

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            method: 'UNSUBSCRIBE',
            params: [streamName],
            id: Date.now(),
          })
        );
      }

      if (this.activeSubscriptions.size === 0) {
        this.ws?.close();
      }
    }
  }

  // 1. Basic Price Subscription
  public subscribe(symbol: string, callback: PriceCallback) {
    const rawSymbol = this.normalizeSymbol(symbol);

    if (!this.subscribers.has(rawSymbol)) {
      this.subscribers.set(rawSymbol, new Set());
    }

    this.subscribers.get(rawSymbol)!.add(callback);
    this.sendSubscribe(`${rawSymbol}@ticker`);
  }

  public unsubscribe(symbol: string, callback: PriceCallback) {
    const rawSymbol = this.normalizeSymbol(symbol);
    const symbolSubscribers = this.subscribers.get(rawSymbol);

    if (symbolSubscribers) {
      symbolSubscribers.delete(callback);

      if (symbolSubscribers.size === 0) {
        this.subscribers.delete(rawSymbol);
        // Only unsubscribe from websocket if tickerSubscribers is also empty
        if (!this.tickerSubscribers.has(rawSymbol) || this.tickerSubscribers.get(rawSymbol)!.size === 0) {
          this.sendUnsubscribe(`${rawSymbol}@ticker`);
        }
      }
    }
  }

  // 2. Full 24hr Ticker Subscription
  public subscribeTicker(symbol: string, callback: TickerCallback): () => void {
    const rawSymbol = this.normalizeSymbol(symbol);

    if (!this.tickerSubscribers.has(rawSymbol)) {
      this.tickerSubscribers.set(rawSymbol, new Set());
    }

    this.tickerSubscribers.get(rawSymbol)!.add(callback);
    this.sendSubscribe(`${rawSymbol}@ticker`);

    return () => {
      const callbacks = this.tickerSubscribers.get(rawSymbol);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.tickerSubscribers.delete(rawSymbol);
          if (!this.subscribers.has(rawSymbol) || this.subscribers.get(rawSymbol)!.size === 0) {
            this.sendUnsubscribe(`${rawSymbol}@ticker`);
          }
        }
      }
    };
  }

  // 3. Order Book Depth Subscription (top 20 levels at 100ms)
  public subscribeDepth(symbol: string, callback: DepthCallback): () => void {
    const rawSymbol = this.normalizeSymbol(symbol);
    const streamName = `${rawSymbol}@depth20@100ms`;

    if (!this.depthSubscribers.has(rawSymbol)) {
      this.depthSubscribers.set(rawSymbol, new Set());
    }

    this.depthSubscribers.get(rawSymbol)!.add(callback);
    this.sendSubscribe(streamName);

    return () => {
      const callbacks = this.depthSubscribers.get(rawSymbol);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.depthSubscribers.delete(rawSymbol);
          this.sendUnsubscribe(streamName);
        }
      }
    };
  }

  // 4. Kline / Candle Subscription
  public subscribeKline(symbol: string, interval: string, callback: KlineCallback): () => void {
    const rawSymbol = this.normalizeSymbol(symbol);
    const streamKey = `${rawSymbol}@${interval}`;
    const streamName = `${rawSymbol}@kline_${interval}`;

    if (!this.klineSubscribers.has(streamKey)) {
      this.klineSubscribers.set(streamKey, new Set());
    }

    this.klineSubscribers.get(streamKey)!.add(callback);
    this.sendSubscribe(streamName);

    return () => {
      const callbacks = this.klineSubscribers.get(streamKey);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.klineSubscribers.delete(streamKey);
          this.sendUnsubscribe(streamName);
        }
      }
    };
  }
}

export const livePriceService = new LivePriceService();
