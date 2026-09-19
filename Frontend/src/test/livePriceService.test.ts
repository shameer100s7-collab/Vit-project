import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { livePriceService } from '../api/livePriceService';

describe('LivePriceService', () => {
  let wsMock: any;

  beforeEach(() => {
    wsMock = {
      send: vi.fn(),
      close: vi.fn(),
      readyState: 1, // OPEN
    };
    
    const WS = vi.fn(() => wsMock) as any;
    WS.OPEN = 1;
    WS.CONNECTING = 0;
    
    global.WebSocket = WS;
    vi.useFakeTimers();
  });

  afterEach(() => {
    (livePriceService as any).ws = null;
    (livePriceService as any).subscribers.clear();
    (livePriceService as any).activeSubscriptions.clear();
    (livePriceService as any).isConnecting = false;
    vi.restoreAllMocks();
  });

  it('connects to websocket and subscribes to symbol', () => {
    const callback = vi.fn();
    livePriceService.subscribe('BTC/USDT', callback);

    // Assert websocket is created
    expect(global.WebSocket).toHaveBeenCalledWith('wss://stream.binance.com:9443/ws');
    
    // Simulate connection open
    wsMock.onopen();

    // Now if we subscribe again (or because of active set) it should send
    livePriceService.subscribe('ETH/USDT', vi.fn());
    
    expect(wsMock.send).toHaveBeenCalled();
    // 1st call is from onopen (btcusdt), 2nd call is from ETH subscribe
    const sendArg = JSON.parse(wsMock.send.mock.calls[1][0]);
    expect(sendArg.method).toBe('SUBSCRIBE');
    expect(sendArg.params).toContain('ethusdt@ticker');
  });

  it('dispatches price updates to subscribers', () => {
    const callback = vi.fn();
    livePriceService.subscribe('BTC/USDT', callback);
    wsMock.onopen();

    // Simulate incoming message
    wsMock.onmessage({
      data: JSON.stringify({
        e: '24hrTicker',
        s: 'BTCUSDT',
        c: '50000.50'
      })
    });

    expect(callback).toHaveBeenCalledWith(50000.50);
  });
});
