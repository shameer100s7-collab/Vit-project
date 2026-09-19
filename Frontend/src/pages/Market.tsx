import React, { useEffect, useState, useCallback } from 'react';
import { marketApi } from '../api';
import {
  CanonicalPrice,
  CanonicalCandle,
  CanonicalOrderBook,
  CanonicalVolume,
  CanonicalAssetMetadata,
} from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { RefreshCw, TrendingUp, Layers, HardDrive, DollarSign, Activity } from 'lucide-react';

export const Market: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const [price, setPrice] = useState<CanonicalPrice | null>(null);
  const [candles, setCandles] = useState<CanonicalCandle[]>([]);
  const [orderbook, setOrderbook] = useState<CanonicalOrderBook | null>(null);
  const [volume, setVolume] = useState<CanonicalVolume | null>(null);
  const [metadata, setMetadata] = useState<CanonicalAssetMetadata | null>(null);
  const [providerHealth, setProviderHealth] = useState<Record<string, any> | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  const fetchMarketData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [pRes, cRes, obRes, vRes, mRes, hRes] = await Promise.all([
        marketApi.getPrice(selectedSymbol),
        marketApi.getOhlcv(selectedSymbol, timeframe, 20),
        marketApi.getOrderBook(selectedSymbol, 12),
        marketApi.getVolume(selectedSymbol),
        marketApi.getMetadata(selectedSymbol).catch(() => null),
        marketApi.getProviderHealth().catch(() => null),
      ]);

      setPrice(pRes.data);
      setCandles(cRes.data);
      setOrderbook(obRes.data);
      setVolume(vRes.data);
      if (mRes) setMetadata(mRes.data);
      if (hRes) setProviderHealth(hRes.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, timeframe]);

  useEffect(() => {
    fetchMarketData();
  }, [fetchMarketData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ghost-border">
        <div>
          <h1 className="text-xl font-mono font-bold tracking-tight text-ghost-textPrimary uppercase">
            Market Microstructure & Feeds
          </h1>
          <p className="text-xs font-mono text-ghost-textMuted mt-0.5">
            Real-time normalized price quotations, order book depth, OHLCV time series, and provider diagnostics
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <AssetSelector
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(s) => setSelectedSymbol(s)}
          />

          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-2.5 py-1.5 bg-ghost-card border border-ghost-border rounded-lg text-ghost-textPrimary focus:outline-none focus:border-ghost-cyan text-xs font-mono"
          >
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>

          <button
            onClick={fetchMarketData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-borderLight text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchMarketData} />}

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="QUOTED PRICE"
          value={price ? `$${price.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : '—'}
          change={volume?.price_change_pct_24h}
          subValue={price ? `Source: ${price.source}` : undefined}
          icon={<DollarSign className="w-4 h-4" />}
          variant="cyan"
        />

        <MetricCard
          label="24H NOTIONAL VOLUME"
          value={volume ? `$${(volume.quote_volume_24h / 1e6).toFixed(2)}M` : '—'}
          subValue={volume ? `Base: ${(volume.volume_24h).toFixed(1)} units` : undefined}
          icon={<TrendingUp className="w-4 h-4" />}
          variant="default"
        />

        <MetricCard
          label="SPREAD (BPS)"
          value={orderbook ? `${(orderbook.spread_pct * 100).toFixed(2)}%` : '—'}
          subValue={orderbook ? `Raw Spread: $${orderbook.spread.toFixed(2)}` : undefined}
          icon={<Layers className="w-4 h-4" />}
          variant="default"
        />

        <MetricCard
          label="PROVIDER TELEMETRY"
          value={providerHealth?.status === 'healthy' ? 'HEALTHY' : 'CONNECTED'}
          subValue={providerHealth ? `Provider: ${providerHealth.provider || 'Mock/Binance'}` : 'Online'}
          icon={<HardDrive className="w-4 h-4" />}
          variant="green"
        />
      </div>

      {/* Main Grid: Order Book & OHLCV Candles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Order Book Depth */}
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-ghost-border/60">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-ghost-cyan" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                Depth of Market ({selectedSymbol})
              </h3>
            </div>
            {orderbook && (
              <span className="text-2xs font-mono text-ghost-textMuted">
                Spread: ${orderbook.spread.toFixed(2)} ({(orderbook.spread_pct * 100).toFixed(3)}%)
              </span>
            )}
          </div>

          {orderbook ? (
            <div className="grid grid-cols-2 gap-4 font-mono text-xs">
              {/* Asks (Sell Side) */}
              <div>
                <div className="flex justify-between text-2xs font-bold text-ghost-red uppercase pb-1 border-b border-ghost-border/40 mb-1">
                  <span>ASK PRICE</span>
                  <span>SIZE</span>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {orderbook.asks.slice(0, 10).map((ask, i) => (
                    <div key={i} className="flex justify-between items-center text-2xs py-0.5 hover:bg-ghost-red/10 rounded px-1">
                      <span className="text-ghost-red font-semibold">${ask.price.toFixed(2)}</span>
                      <span className="text-ghost-textPrimary">{ask.quantity.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bids (Buy Side) */}
              <div>
                <div className="flex justify-between text-2xs font-bold text-ghost-green uppercase pb-1 border-b border-ghost-border/40 mb-1">
                  <span>BID PRICE</span>
                  <span>SIZE</span>
                </div>
                <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                  {orderbook.bids.slice(0, 10).map((bid, i) => (
                    <div key={i} className="flex justify-between items-center text-2xs py-0.5 hover:bg-ghost-green/10 rounded px-1">
                      <span className="text-ghost-green font-semibold">${bid.price.toFixed(2)}</span>
                      <span className="text-ghost-textPrimary">{bid.quantity.toFixed(4)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <LoadingState message="Loading depth of market levels..." minHeight="min-h-[220px]" />
          )}
        </div>

        {/* Panel 2: Historical OHLCV Time Series */}
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-ghost-border/60">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-ghost-cyan" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                  Chronological OHLCV Series ({timeframe})
                </h3>
              </div>
              <span className="text-2xs font-mono text-ghost-textMuted">
                {candles.length} Candles
              </span>
            </div>

            {candles.length > 0 ? (
              <div className="overflow-x-auto max-h-72">
                <table className="w-full text-left font-mono text-2xs">
                  <thead className="border-b border-ghost-border/60 text-ghost-textMuted uppercase">
                    <tr>
                      <th className="py-1.5 px-2">Time</th>
                      <th className="py-1.5 px-2 text-right">Open</th>
                      <th className="py-1.5 px-2 text-right">High</th>
                      <th className="py-1.5 px-2 text-right">Low</th>
                      <th className="py-1.5 px-2 text-right">Close</th>
                      <th className="py-1.5 px-2 text-right">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ghost-border/30">
                    {candles.slice(-10).reverse().map((c, i) => {
                      const isUp = c.close >= c.open;
                      return (
                        <tr key={i} className="hover:bg-ghost-border/20 transition-colors">
                          <td className="py-1.5 px-2 text-ghost-textMuted">
                            {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-1.5 px-2 text-right">${c.open.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right text-ghost-green">${c.high.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right text-ghost-red">${c.low.toFixed(2)}</td>
                          <td className={`py-1.5 px-2 text-right font-bold ${isUp ? 'text-ghost-green' : 'text-ghost-red'}`}>
                            ${c.close.toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2 text-right text-ghost-textPrimary">{c.volume.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <LoadingState message="Fetching OHLCV time series..." minHeight="min-h-[220px]" />
            )}
          </div>

          {/* Metadata Footer */}
          {metadata && (
            <div className="mt-4 pt-3 border-t border-ghost-border/60 flex flex-wrap gap-4 text-2xs font-mono text-ghost-textMuted">
              <span>BASE: <strong className="text-ghost-textPrimary">{metadata.base_asset}</strong></span>
              <span>QUOTE: <strong className="text-ghost-textPrimary">{metadata.quote_asset}</strong></span>
              <span>PRICE PRECISION: <strong className="text-ghost-textPrimary">{metadata.price_precision}</strong></span>
              <span>MIN ORDER: <strong className="text-ghost-textPrimary">{metadata.min_order_quantity}</strong></span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
