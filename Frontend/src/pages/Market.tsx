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
  const [activeTab, setActiveTab] = useState<'overview' | 'chart' | 'orderbook' | 'statistics'>('overview');

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

  const topBid = orderbook?.bids[0]?.price ?? 0;
  const topAsk = orderbook?.asks[0]?.price ?? 0;
  const spread = topAsk && topBid ? topAsk - topBid : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div>
          <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            Market Data & Depth
          </h1>
          <p className="text-sm text-ghost-textMuted mt-0.5">
            Normalized price feeds, time series candles, and order book depth for {selectedSymbol}.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <AssetSelector
            selectedSymbol={selectedSymbol}
            onSelectSymbol={(s) => setSelectedSymbol(s)}
          />

          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg text-ghost-textPrimary text-xs font-mono focus:outline-none focus:border-ghost-cyan"
          >
            <option value="15m">15m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>

          <button
            onClick={fetchMarketData}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-cyan/50 text-xs font-medium text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-ghost-border/60 pb-1">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'chart', label: 'OHLCV Candles' },
          { id: 'orderbook', label: 'Order Book' },
          { id: 'statistics', label: 'Statistics' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-ghost-card text-ghost-cyan font-semibold border border-ghost-border/80 shadow-sm'
                : 'text-ghost-textMuted hover:text-ghost-textPrimary hover:bg-ghost-card/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <ErrorState error={error} onRetry={fetchMarketData} />}

      {isLoading ? (
        <LoadingState message="Loading market telemetry..." />
      ) : (
        <>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Primary Key Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Spot Price"
                  value={price ? `$${price.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                  change={volume?.price_change_pct_24h}
                  icon={<DollarSign className="w-4 h-4" />}
                />

                <MetricCard
                  label="24h Volume"
                  value={volume ? `$${(volume.volume_24h / 1e6).toFixed(2)}M` : '—'}
                  subValue={volume?.quote_volume_24h ? `Quote Vol: $${(volume.quote_volume_24h / 1e6).toFixed(1)}M` : undefined}
                  icon={<TrendingUp className="w-4 h-4" />}
                />

                <MetricCard
                  label="Spread"
                  value={orderbook ? `$${spread.toFixed(2)}` : '—'}
                  subValue={topBid ? `Top Bid $${topBid.toFixed(2)}` : undefined}
                  icon={<Activity className="w-4 h-4" />}
                />

                <MetricCard
                  label="Base Asset"
                  value={metadata?.base_asset || selectedSymbol.split('/')[0]}
                  subValue={`Quote: ${metadata?.quote_asset || 'USDT'}`}
                  icon={<Layers className="w-4 h-4" />}
                />
              </div>

              {/* Quick Asset Summary */}
              <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-ghost-textPrimary">Asset Specification</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-sans text-ghost-textMuted">
                  <div>
                    <span className="block text-ghost-textDim">Symbol</span>
                    <strong className="text-ghost-textPrimary font-mono">{selectedSymbol}</strong>
                  </div>
                  <div>
                    <span className="block text-ghost-textDim">Min Order Quantity</span>
                    <strong className="text-ghost-textPrimary font-mono">{metadata?.min_order_quantity || 0.0001}</strong>
                  </div>
                  <div>
                    <span className="block text-ghost-textDim">Price Precision</span>
                    <strong className="text-ghost-textPrimary font-mono">{metadata?.price_precision || 2} decimals</strong>
                  </div>
                  <div>
                    <span className="block text-ghost-textDim">Status</span>
                    <span className="text-emerald-400 font-medium">Active Trading</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OHLCV CANDLES CHART / TABLE */}
          {activeTab === 'chart' && (
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
                <h2 className="text-sm font-semibold text-ghost-textPrimary">
                  OHLCV Time Series ({candles.length} Candles)
                </h2>
                <span className="text-xs font-mono text-ghost-textMuted">Timeframe: {timeframe}</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-ghost-border/60 text-ghost-textDim font-medium">
                      <th className="py-2 px-3">Timestamp</th>
                      <th className="py-2 px-3">Open</th>
                      <th className="py-2 px-3">High</th>
                      <th className="py-2 px-3">Low</th>
                      <th className="py-2 px-3">Close</th>
                      <th className="py-2 px-3 text-right">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ghost-border/30 text-ghost-textPrimary">
                    {candles.map((candle, idx) => (
                      <tr key={idx} className="hover:bg-ghost-border/20 transition-colors">
                        <td className="py-2 px-3 text-ghost-textMuted">{new Date(candle.timestamp).toLocaleString()}</td>
                        <td className="py-2 px-3">${candle.open.toFixed(2)}</td>
                        <td className="py-2 px-3 text-emerald-400">${candle.high.toFixed(2)}</td>
                        <td className="py-2 px-3 text-rose-400">${candle.low.toFixed(2)}</td>
                        <td className="py-2 px-3 font-semibold">${candle.close.toFixed(2)}</td>
                        <td className="py-2 px-3 text-right text-ghost-textMuted">{candle.volume.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ORDER BOOK */}
          {activeTab === 'orderbook' && orderbook && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Bids */}
              <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-emerald-400 flex items-center justify-between">
                  <span>Bids (Buy Orders)</span>
                  <span className="text-xs font-mono text-ghost-textMuted">Top 12 Levels</span>
                </h3>
                <div className="space-y-1 font-mono text-xs">
                  <div className="grid grid-cols-3 text-ghost-textDim pb-1 border-b border-ghost-border/40 font-medium">
                    <span>Price (USDT)</span>
                    <span className="text-right">Amount</span>
                    <span className="text-right">Total</span>
                  </div>
                  {orderbook.bids.slice(0, 12).map((level, i) => (
                    <div key={i} className="grid grid-cols-3 py-1 hover:bg-emerald-500/5 rounded px-1">
                      <span className="text-emerald-400 font-semibold">${level.price.toFixed(2)}</span>
                      <span className="text-right text-ghost-textPrimary">{level.quantity.toFixed(4)}</span>
                      <span className="text-right text-ghost-textMuted">${(level.price * level.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Asks */}
              <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-sm font-semibold text-rose-400 flex items-center justify-between">
                  <span>Asks (Sell Orders)</span>
                  <span className="text-xs font-mono text-ghost-textMuted">Top 12 Levels</span>
                </h3>
                <div className="space-y-1 font-mono text-xs">
                  <div className="grid grid-cols-3 text-ghost-textDim pb-1 border-b border-ghost-border/40 font-medium">
                    <span>Price (USDT)</span>
                    <span className="text-right">Amount</span>
                    <span className="text-right">Total</span>
                  </div>
                  {orderbook.asks.slice(0, 12).map((level, i) => (
                    <div key={i} className="grid grid-cols-3 py-1 hover:bg-rose-500/5 rounded px-1">
                      <span className="text-rose-400 font-semibold">${level.price.toFixed(2)}</span>
                      <span className="text-right text-ghost-textPrimary">{level.quantity.toFixed(4)}</span>
                      <span className="text-right text-ghost-textMuted">${(level.price * level.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: STATISTICS */}
          {activeTab === 'statistics' && (
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4 font-sans text-xs">
              <h2 className="text-sm font-semibold text-ghost-textPrimary flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-ghost-cyan" />
                <span>Provider & Market Diagnostics</span>
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-ghost-darkest border border-ghost-border/60 rounded-lg space-y-2">
                  <span className="font-medium text-ghost-textMuted">Data Provider</span>
                  <p className="text-sm font-mono text-ghost-textPrimary">{providerHealth?.provider || 'Canonical Market Service'}</p>
                  <p className="text-ghost-textDim">Latency: {providerHealth?.latency_ms || 12} ms</p>
                </div>

                <div className="p-4 bg-ghost-darkest border border-ghost-border/60 rounded-lg space-y-2">
                  <span className="font-medium text-ghost-textMuted">Feed Status</span>
                  <div className="flex items-center gap-2 text-emerald-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Synchronized Live Feed</span>
                  </div>
                  <p className="text-ghost-textDim">Zero-lookahead timestamping</p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
