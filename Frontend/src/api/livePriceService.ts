type PriceCallback = (price: number) => void;

class LivePriceService {
  private ws: WebSocket | null = null;
  private readonly baseUrl = 'wss://stream.binance.com:9443/ws';
  private subscribers: Map<string, Set<PriceCallback>> = new Map();
  private activeSubscriptions: Set<string> = new Set();
  
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  private normalizeSymbol(symbol: string): string {
    // Converts "BTC/USDT" to "btcusdt"
    return symbol.replace('/', '').toLowerCase();
  }

  private connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) return;
    
    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(this.baseUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Resubscribe to all active symbols
        if (this.activeSubscriptions.size > 0) {
          const params = Array.from(this.activeSubscriptions).map(sym => `${sym}@ticker`);
          this.ws?.send(JSON.stringify({
            method: 'SUBSCRIBE',
            params,
            id: 1
          }));
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Binance ticker stream format
          if (data.e === '24hrTicker' && data.s && data.c) {
            const rawSymbol = data.s.toLowerCase(); // e.g. "btcusdt"
            const price = parseFloat(data.c);
            
            const callbacks = this.subscribers.get(rawSymbol);
            if (callbacks) {
              callbacks.forEach(cb => cb(price));
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

  public subscribe(symbol: string, callback: PriceCallback) {
    const rawSymbol = this.normalizeSymbol(symbol);
    
    if (!this.subscribers.has(rawSymbol)) {
      this.subscribers.set(rawSymbol, new Set());
    }
    
    this.subscribers.get(rawSymbol)!.add(callback);
    
    if (!this.activeSubscriptions.has(rawSymbol)) {
      this.activeSubscriptions.add(rawSymbol);
      
      // If connected, send subscribe message immediately
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          method: 'SUBSCRIBE',
          params: [`${rawSymbol}@ticker`],
          id: Date.now()
        }));
      } else if (!this.ws && !this.isConnecting) {
        this.connect();
      }
    }
  }

  public unsubscribe(symbol: string, callback: PriceCallback) {
    const rawSymbol = this.normalizeSymbol(symbol);
    const symbolSubscribers = this.subscribers.get(rawSymbol);
    
    if (symbolSubscribers) {
      symbolSubscribers.delete(callback);
      
      if (symbolSubscribers.size === 0) {
        this.subscribers.delete(rawSymbol);
        this.activeSubscriptions.delete(rawSymbol);
        
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            method: 'UNSUBSCRIBE',
            params: [`${rawSymbol}@ticker`],
            id: Date.now()
          }));
        }
        
        if (this.activeSubscriptions.size === 0) {
          this.ws?.close();
        }
      }
    }
  }
}

export const livePriceService = new LivePriceService();
