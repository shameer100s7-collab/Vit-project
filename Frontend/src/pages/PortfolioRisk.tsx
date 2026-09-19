import React, { useEffect, useState, useMemo } from 'react';
import { portfolioService, PortfolioData, PortfolioAssetItem, riskApi } from '../api';
import { PortfolioRiskResult } from '../types';
import { useLivePrice } from '../hooks/useLivePrice';
import { 
  PieChart, 
  ShieldAlert, 
  ArrowRight, 
  Wallet as WalletIcon, 
  Plus, 
  RefreshCw, 
  Trash2, 
  Check, 
  Info, 
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/common/Card';
import { Drawer } from '../components/common/Drawer';
import { SkeletonCard } from '../components/common/Skeleton';

const SUPPORTED_NETWORKS = [
  { name: 'Ethereum', symbol: 'ETH', placeholder: '0x...', example: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' },
  { name: 'Bitcoin', symbol: 'BTC', placeholder: '1... or bc1...', example: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
  { name: 'Solana', symbol: 'SOL', placeholder: 'Base58 address...', example: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' },
];

const USD_TO_INR = 83.50;

export const PortfolioRisk: React.FC = () => {
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [riskResult, setRiskResult] = useState<PortfolioRiskResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Currency Display Mode State ('USD' | 'INR' | 'BOTH')
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'INR' | 'BOTH'>('USD');

  // Drawer state for adding / managing holdings
  const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'addWallet' | 'addAsset' | 'manageAssets'>('addWallet');
  const [selectedAsset, setSelectedAsset] = useState<PortfolioAssetItem | null>(null);

  // Form states for Add Wallet
  const [walletNetwork, setWalletNetwork] = useState('Ethereum');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletLabel, setWalletLabel] = useState('');
  const [isCheckingWallet, setIsCheckingWallet] = useState(false);
  const [walletCheckError, setWalletCheckError] = useState<string | null>(null);
  const [walletSuccessMsg, setWalletSuccessMsg] = useState<string | null>(null);

  // Form states for Add Manual Asset
  const [manualSymbol, setManualSymbol] = useState('BTC');
  const [manualNetwork, setManualNetwork] = useState('Bitcoin');
  const [manualQuantity, setManualQuantity] = useState('');
  const [manualEntryPrice, setManualEntryPrice] = useState('');
  const [assetFormError, setAssetFormError] = useState<string | null>(null);
  const [assetSuccessMsg, setAssetSuccessMsg] = useState<string | null>(null);

  // Live Prices from WebSocket
  const btcPrice = useLivePrice('BTC/USDT');
  const ethPrice = useLivePrice('ETH/USDT');
  const solPrice = useLivePrice('SOL/USDT');

  const priceMap: Record<string, number | null> = useMemo(() => ({
    BTC: btcPrice || null,
    ETH: ethPrice || null,
    SOL: solPrice || null,
    USDT: 1.0,
    USDC: 1.0,
  }), [btcPrice, ethPrice, solPrice]);

  const fetchPortfolioData = async () => {
    try {
      setError(null);
      const data = await portfolioService.getPortfolio();
      setPortfolio(data);
      setLastRefreshedAt(new Date());

      // Evaluate Risk via backend engine if holdings exist
      if (data.assets.length > 0) {
        const assetsToRisk = data.assets.map(a => ({
          symbol: a.symbol.includes('/') ? a.symbol : `${a.symbol}/USDT`,
          weight: a.quantity
        }));
        const riskRes = await riskApi.evaluatePortfolioRisk({
          portfolio_name: data.name || 'Core Portfolio',
          benchmark_symbol: 'BTC/USDT',
          assets: assetsToRisk
        });
        setRiskResult(riskRes.data);
      } else {
        setRiskResult(null);
      }
    } catch (err: any) {
      console.error('[Portfolio] Load error:', err);
      setError('Unable to load portfolio data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    await fetchPortfolioData();
    setIsRefreshing(false);
  };

  // Group assets by symbol and compute live USD values
  const enrichedAssets = useMemo(() => {
    if (!portfolio || !portfolio.assets) return [];

    const assetMap: Record<string, {
      id: string;
      symbol: string;
      quantity: number;
      avgEntryPrice: number;
      sources: Set<string>;
      networks: Set<string>;
      usdValue: number;
      price: number | null;
    }> = {};

    let totalUsd = 0;

    portfolio.assets.forEach(a => {
      const sym = a.symbol.toUpperCase();
      const liveP = priceMap[sym] ?? null;
      const usdVal = liveP ? a.quantity * liveP : 0;
      totalUsd += usdVal;

      if (!assetMap[sym]) {
        assetMap[sym] = {
          id: a.id,
          symbol: sym,
          quantity: a.quantity,
          avgEntryPrice: a.avg_entry_price || 0,
          sources: new Set([a.source]),
          networks: new Set([a.network || 'Mainnet']),
          usdValue: usdVal,
          price: liveP,
        };
      } else {
        assetMap[sym].quantity += a.quantity;
        assetMap[sym].usdValue += usdVal;
        assetMap[sym].sources.add(a.source);
        if (a.network) assetMap[sym].networks.add(a.network);
      }
    });

    return Object.values(assetMap).map(a => ({
      ...a,
      allocation: totalUsd > 0 ? (a.usdValue / totalUsd) * 100 : 0,
      sourcesList: Array.from(a.sources).join(', '),
      networksList: Array.from(a.networks).join(', '),
    })).sort((a, b) => b.usdValue - a.usdValue);
  }, [portfolio, priceMap]);

  const totalPortfolioValueUSD = useMemo(() => {
    return enrichedAssets.reduce((sum, a) => sum + a.usdValue, 0);
  }, [enrichedAssets]);

  const totalPortfolioValueINR = useMemo(() => {
    return totalPortfolioValueUSD * USD_TO_INR;
  }, [totalPortfolioValueUSD]);

  // Currency Formatter Helper
  const formatVal = (usdVal: number, mode: 'USD' | 'INR' | 'BOTH' = currencyMode): string => {
    if (!usdVal || usdVal <= 0) return 'Price unavailable';
    const usdStr = `$${usdVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const inrVal = usdVal * USD_TO_INR;
    const inrStr = `₹${inrVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    if (mode === 'USD') return usdStr;
    if (mode === 'INR') return inrStr;
    return `${usdStr} (${inrStr})`;
  };

  // Handle Add Wallet Submission
  const handleAddWalletSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalletCheckError(null);
    setWalletSuccessMsg(null);
    setIsCheckingWallet(true);

    try {
      const newWallet = await portfolioService.addWallet({
        address: walletAddress.trim(),
        network: walletNetwork,
        label: walletLabel.trim() || `${walletNetwork} Wallet`,
      });

      setWalletSuccessMsg(`Wallet added! Detected ${newWallet.asset_count} assets on ${walletNetwork}.`);
      setWalletAddress('');
      setWalletLabel('');
      await fetchPortfolioData();
    } catch (err: any) {
      setWalletCheckError(err.message || 'Failed to verify or connect wallet address.');
    } finally {
      setIsCheckingWallet(false);
    }
  };

  // Handle Add Manual Holding Submission
  const handleAddManualAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAssetFormError(null);
    setAssetSuccessMsg(null);

    const qty = parseFloat(manualQuantity);
    const entry = parseFloat(manualEntryPrice) || 0;

    if (isNaN(qty) || qty <= 0) {
      setAssetFormError('Please enter a valid positive quantity.');
      return;
    }

    try {
      await portfolioService.addManualAsset({
        symbol: manualSymbol.toUpperCase().trim(),
        quantity: qty,
        avg_entry_price: entry,
        network: manualNetwork,
      });

      setAssetSuccessMsg(`Added ${qty} ${manualSymbol.toUpperCase()} to portfolio.`);
      setManualQuantity('');
      setManualEntryPrice('');
      await fetchPortfolioData();
    } catch (err: any) {
      setAssetFormError(err.message || 'Failed to add manual asset.');
    }
  };

  const handleRemoveWallet = async (walletId: string) => {
    try {
      await portfolioService.removeWallet(walletId);
      await fetchPortfolioData();
    } catch {
      setError('Failed to remove wallet.');
    }
  };

  const handleRemoveAsset = async (assetId: string) => {
    try {
      await portfolioService.removeManualAsset(assetId);
      await fetchPortfolioData();
    } catch {
      setError('Failed to remove asset holding.');
    }
  };

  const shortenAddress = (addr: string) => {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse max-w-6xl mx-auto py-4">
        <div className="h-10 bg-ghost-card border border-ghost-border rounded-xl w-1/3" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200 max-w-6xl mx-auto">
      {/* Page Header */}
      <PageHeader
        title="Portfolio & Balances"
        subtitle="Multi-chain wallet tracking and manual holdings with real-time risk assessment."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Currency Mode Selector Pill */}
            <div className="inline-flex bg-ghost-bg border border-ghost-border p-1 rounded-xl text-xs">
              <button
                onClick={() => setCurrencyMode('USD')}
                className={`px-3 py-1 rounded-lg transition-colors font-semibold ${
                  currencyMode === 'USD'
                    ? 'bg-ghost-burgundy text-ghost-sand shadow-sm'
                    : 'text-ghost-textMuted hover:text-ghost-textPrimary'
                }`}
              >
                USD ($)
              </button>
              <button
                onClick={() => setCurrencyMode('INR')}
                className={`px-3 py-1 rounded-lg transition-colors font-semibold ${
                  currencyMode === 'INR'
                    ? 'bg-ghost-burgundy text-ghost-sand shadow-sm'
                    : 'text-ghost-textMuted hover:text-ghost-textPrimary'
                }`}
              >
                INR (₹)
              </button>
              <button
                onClick={() => setCurrencyMode('BOTH')}
                className={`px-3 py-1 rounded-lg transition-colors font-semibold ${
                  currencyMode === 'BOTH'
                    ? 'bg-ghost-burgundy text-ghost-sand shadow-sm'
                    : 'text-ghost-textMuted hover:text-ghost-textPrimary'
                }`}
              >
                Both
              </button>
            </div>

            <button
              onClick={handleRefreshAll}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 rounded-xl bg-ghost-card hover:bg-ghost-cardHover border border-ghost-border text-xs font-semibold text-ghost-textPrimary transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-ghost-sand' : 'text-ghost-textMuted'}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('addWallet');
                setIsEditDrawerOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-ghost-burgundy hover:bg-ghost-burgundyLight text-ghost-sand border border-ghost-sand/30 text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add / Manage Holdings</span>
            </button>
          </div>
        }
      />

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center justify-between">
          <span>{error}</span>
          <button onClick={handleRefreshAll} className="underline font-semibold text-rose-200">
            Retry
          </button>
        </div>
      )}

      {/* Main Grid Content */}
      {enrichedAssets.length === 0 ? (
        /* Empty State */
        <Card className="text-center py-16 px-6 space-y-4 max-w-xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-ghost-burgundy/20 border border-ghost-sand/30 flex items-center justify-center mx-auto text-ghost-sand">
            <WalletIcon className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-ghost-textPrimary">No Assets Tracked Yet</h2>
            <p className="text-xs text-ghost-textMuted max-w-md mx-auto mt-1 leading-relaxed">
              Connect a read-only public wallet address or enter your manual holdings to track live multi-asset valuations and risk.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setActiveTab('addWallet');
                setIsEditDrawerOpen(true);
              }}
              className="px-4 py-2 bg-ghost-burgundy hover:bg-ghost-burgundyLight text-ghost-sand font-semibold text-xs rounded-xl transition-colors flex items-center gap-2 shadow-sm"
            >
              <WalletIcon className="w-4 h-4" />
              <span>Connect Wallet</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('addAsset');
                setIsEditDrawerOpen(true);
              }}
              className="px-4 py-2 bg-ghost-card hover:bg-ghost-cardHover border border-ghost-border text-ghost-textPrimary font-semibold text-xs rounded-xl transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Manual Holding</span>
            </button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Top Hero Stats Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="space-y-2">
              <span className="text-xs font-semibold text-ghost-textMuted uppercase tracking-wider block">
                Total Portfolio Value
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-ghost-sand tracking-tight">
                  {currencyMode === 'INR'
                    ? `₹${totalPortfolioValueINR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : `$${totalPortfolioValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
                {totalPortfolioValueUSD > 0 && (
                  <span className="text-emerald-400 text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    +2.40%
                  </span>
                )}
              </div>
              {currencyMode === 'BOTH' && totalPortfolioValueUSD > 0 && (
                <div className="text-xs text-ghost-sand/90 font-medium">
                  ≈ ₹{totalPortfolioValueINR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR
                </div>
              )}
              <div className="text-[11px] text-ghost-textMuted pt-1 flex items-center gap-2">
                <span>Updated {Math.round((new Date().getTime() - lastRefreshedAt.getTime()) / 1000)}s ago</span>
                <span>•</span>
                <span>1 USD = ₹{USD_TO_INR.toFixed(2)}</span>
              </div>
            </Card>

            <Card className="space-y-2">
              <span className="text-xs font-semibold text-ghost-textMuted uppercase tracking-wider block">
                Portfolio Holdings
              </span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-ghost-textPrimary tracking-tight">
                  {enrichedAssets.length}
                </span>
                <span className="text-xs text-ghost-textMuted">unique assets</span>
              </div>
              <div className="text-xs text-ghost-textMuted pt-1 flex items-center gap-3">
                <span>Wallets: <strong className="text-ghost-textPrimary">{portfolio?.wallets?.length || 0}</strong></span>
                <span>•</span>
                <span>Top: <strong className="text-ghost-sand font-bold">{enrichedAssets[0]?.symbol || '—'}</strong> ({enrichedAssets[0]?.allocation.toFixed(1) || 0}%)</span>
              </div>
            </Card>

            <Card className="space-y-2">
              <span className="text-xs font-semibold text-ghost-textMuted uppercase tracking-wider block">
                Risk Classification
              </span>
              <div className="flex items-center gap-2.5">
                <ShieldAlert className={`w-6 h-6 ${
                  (riskResult?.overall_risk_score ?? 0) > 70
                    ? 'text-rose-400'
                    : (riskResult?.overall_risk_score ?? 0) > 40
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`} />
                <span className="text-2xl font-extrabold text-ghost-textPrimary tracking-tight">
                  {riskResult ? (
                    riskResult.overall_risk_score > 70 ? 'High Risk' : riskResult.overall_risk_score > 40 ? 'Moderate' : 'Low Risk'
                  ) : (
                    'Unrated'
                  )}
                </span>
              </div>
              <div className="text-xs text-ghost-textMuted pt-1">
                Daily VaR (95%): <strong className="text-ghost-textPrimary">{riskResult ? `${(riskResult.portfolio_var_95_daily * 100).toFixed(2)}%` : '—'}</strong>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Allocation & Breakdown */}
            <div className="lg:col-span-2 space-y-6">
              {/* Allocation Card */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-ghost-sand" />
                    <h2 className="text-sm font-bold text-ghost-textPrimary">Asset Allocation</h2>
                  </div>
                  <span className="text-xs text-ghost-textMuted font-medium">{enrichedAssets.length} Holdings</span>
                </div>

                {/* Visual Allocation Segment Bar */}
                <div className="h-3 flex rounded-full overflow-hidden bg-ghost-bg p-0.5 border border-ghost-border/40">
                  {enrichedAssets.map((a, i) => (
                    <div
                      key={a.symbol}
                      style={{ width: `${Math.max(a.allocation, 2)}%` }}
                      title={`${a.symbol}: ${a.allocation.toFixed(1)}%`}
                      className={`h-full transition-all ${
                        i === 0 ? 'bg-ghost-sand' : i === 1 ? 'bg-ghost-burgundy' : i === 2 ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                  ))}
                </div>

                {/* Assets Table */}
                <div className="divide-y divide-ghost-border/30">
                  {enrichedAssets.map((a, i) => (
                    <div
                      key={a.symbol}
                      onClick={() => {
                        const orig = portfolio?.assets.find(item => item.symbol.toUpperCase() === a.symbol);
                        if (orig) setSelectedAsset(orig);
                      }}
                      className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-ghost-cardHover transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                          i === 0 ? 'bg-ghost-sand' : i === 1 ? 'bg-ghost-burgundy' : i === 2 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ghost-textPrimary text-sm group-hover:text-ghost-sand transition-colors">
                              {a.symbol}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md uppercase font-semibold tracking-wider bg-ghost-bg border border-ghost-border text-ghost-textMuted">
                              {a.sourcesList}
                            </span>
                          </div>
                          <span className="text-xs text-ghost-textMuted">
                            {a.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} {a.symbol}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-ghost-textPrimary text-sm">
                          {formatVal(a.usdValue)}
                        </div>
                        <div className="text-xs text-ghost-sand font-medium">
                          {a.allocation.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Connected Wallets Card */}
              <Card className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
                  <div className="flex items-center gap-2">
                    <WalletIcon className="w-4 h-4 text-ghost-sand" />
                    <h2 className="text-sm font-bold text-ghost-textPrimary">Connected Read-Only Wallets</h2>
                  </div>
                  <button
                    onClick={() => {
                      setActiveTab('addWallet');
                      setIsEditDrawerOpen(true);
                    }}
                    className="text-xs text-ghost-sand hover:underline font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Connect Wallet</span>
                  </button>
                </div>

                {portfolio?.wallets && portfolio.wallets.length > 0 ? (
                  <div className="space-y-2.5">
                    {portfolio.wallets.map((w) => (
                      <div
                        key={w.id}
                        className="flex items-center justify-between p-3.5 bg-ghost-bg/70 border border-ghost-border/60 rounded-xl"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-ghost-burgundy/30 border border-ghost-burgundyLight flex items-center justify-center text-xs font-bold text-ghost-sand">
                            {w.network.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-ghost-textPrimary text-xs">{w.label || w.network}</span>
                              <span className="text-[11px] font-mono text-ghost-textMuted bg-ghost-card px-2 py-0.5 rounded border border-ghost-border/50">
                                {shortenAddress(w.address)}
                              </span>
                            </div>
                            <span className="text-[11px] text-ghost-textMuted">
                              {w.asset_count} assets detected on {w.network}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => portfolioService.refreshWallet(w.id).then(fetchPortfolioData)}
                            className="p-1.5 hover:bg-ghost-card text-ghost-textMuted hover:text-ghost-textPrimary rounded-lg transition-colors"
                            title="Refresh balances"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRemoveWallet(w.id)}
                            className="p-1.5 hover:bg-rose-500/15 text-ghost-textMuted hover:text-rose-400 rounded-lg transition-colors"
                            title="Remove wallet"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-ghost-textMuted border border-dashed border-ghost-border/50 rounded-xl">
                    No public wallets connected yet.
                  </div>
                )}
              </Card>
            </div>

            {/* Right Col: Risk & Advisory */}
            <div className="space-y-6">
              <Card className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b border-ghost-border/50">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-sm font-bold text-ghost-textPrimary">Portfolio Risk Metrics</h2>
                </div>

                {riskResult ? (
                  <div className="space-y-3.5 text-xs">
                    <div className="flex justify-between items-center pb-2.5 border-b border-ghost-border/30">
                      <span className="text-ghost-textMuted">Overall Risk Assessment</span>
                      <span className={`font-semibold ${
                        riskResult.overall_risk_score > 70
                          ? 'text-rose-400'
                          : riskResult.overall_risk_score > 40
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}>
                        {riskResult.overall_risk_score > 70 ? 'High Risk' : riskResult.overall_risk_score > 40 ? 'Moderate' : 'Low Risk'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2.5 border-b border-ghost-border/30">
                      <span className="text-ghost-textMuted">Largest Position</span>
                      <span className="font-semibold text-ghost-textPrimary">
                        {enrichedAssets[0]?.symbol || 'None'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2.5 border-b border-ghost-border/30">
                      <span className="text-ghost-textMuted">Asset Concentration</span>
                      <span className="font-semibold text-ghost-sand">
                        {enrichedAssets[0] ? `${enrichedAssets[0].allocation.toFixed(1)}%` : '0%'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center pb-2.5 border-b border-ghost-border/30">
                      <span className="text-ghost-textMuted">Daily VaR (95%)</span>
                      <span className="font-bold text-ghost-textPrimary">
                        {(riskResult.portfolio_var_95_daily * 100).toFixed(2)}%
                      </span>
                    </div>

                    <button
                      onClick={() => navigate('/research')}
                      className="w-full mt-4 py-2.5 rounded-xl bg-ghost-burgundy hover:bg-ghost-burgundyLight text-ghost-sand border border-ghost-sand/20 transition-all text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
                    >
                      <span>Deep Risk Analysis</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-ghost-textMuted flex flex-col items-center justify-center">
                    <Info className="w-5 h-5 mb-2 opacity-40 text-ghost-sand" />
                    Add asset holdings to compute risk analysis.
                  </div>
                )}
              </Card>

              {/* Non-custodial Security Card */}
              <Card className="space-y-2 p-5 bg-ghost-card border border-ghost-border/70">
                <div className="flex items-center gap-2 text-ghost-sand font-bold text-xs">
                  <Sparkles className="w-4 h-4" />
                  <span>Non-Custodial Architecture</span>
                </div>
                <p className="text-xs text-ghost-textMuted leading-relaxed">
                  GHOST queries public on-chain ledgers in read-only mode. We never request private keys, signatures, or recovery seeds.
                </p>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* Edit Portfolio Slide-Over Drawer */}
      <Drawer
        isOpen={isEditDrawerOpen}
        onClose={() => setIsEditDrawerOpen(false)}
        title="Manage Portfolio Holdings"
        subtitle="Connect on-chain wallets or record manual spot positions."
        width="max-w-lg"
      >
        <div className="space-y-6">
          {/* Sub-tabs */}
          <div className="flex border-b border-ghost-border text-xs font-semibold">
            <button
              onClick={() => setActiveTab('addWallet')}
              className={`py-2 px-3 border-b-2 transition-colors ${
                activeTab === 'addWallet'
                  ? 'border-ghost-sand text-ghost-sand font-bold'
                  : 'border-transparent text-ghost-textMuted hover:text-ghost-textPrimary'
              }`}
            >
              Connect Wallet
            </button>
            <button
              onClick={() => setActiveTab('addAsset')}
              className={`py-2 px-3 border-b-2 transition-colors ${
                activeTab === 'addAsset'
                  ? 'border-ghost-sand text-ghost-sand font-bold'
                  : 'border-transparent text-ghost-textMuted hover:text-ghost-textPrimary'
              }`}
            >
              Add Holding
            </button>
            <button
              onClick={() => setActiveTab('manageAssets')}
              className={`py-2 px-3 border-b-2 transition-colors ${
                activeTab === 'manageAssets'
                  ? 'border-ghost-sand text-ghost-sand font-bold'
                  : 'border-transparent text-ghost-textMuted hover:text-ghost-textPrimary'
              }`}
            >
              Manage ({portfolio?.assets?.length || 0})
            </button>
          </div>

          {/* TAB 1: Add Public Wallet */}
          {activeTab === 'addWallet' && (
            <form onSubmit={handleAddWalletSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-ghost-textMuted mb-1.5 font-semibold">Blockchain Network</label>
                <select
                  value={walletNetwork}
                  onChange={(e) => setWalletNetwork(e.target.value)}
                  className="w-full bg-ghost-bg border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary focus:outline-none focus:border-ghost-sand"
                >
                  {SUPPORTED_NETWORKS.map((net) => (
                    <option key={net.name} value={net.name}>
                      {net.name} ({net.symbol})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-ghost-textMuted mb-1.5 font-semibold">Public Address</label>
                <input
                  type="text"
                  required
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder={SUPPORTED_NETWORKS.find(n => n.name === walletNetwork)?.placeholder || '0x...'}
                  className="w-full bg-ghost-bg border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary font-mono placeholder:text-ghost-textMuted/50 focus:outline-none focus:border-ghost-sand"
                />
                <span className="text-[11px] text-ghost-textMuted mt-1 block">
                  Example: {SUPPORTED_NETWORKS.find(n => n.name === walletNetwork)?.example}
                </span>
              </div>

              <div>
                <label className="block text-ghost-textMuted mb-1.5 font-semibold">Label (Optional)</label>
                <input
                  type="text"
                  value={walletLabel}
                  onChange={(e) => setWalletLabel(e.target.value)}
                  placeholder="e.g. Treasury Multisig"
                  className="w-full bg-ghost-bg border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary focus:outline-none focus:border-ghost-sand"
                />
              </div>

              {walletCheckError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                  {walletCheckError}
                </div>
              )}

              {walletSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{walletSuccessMsg}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isCheckingWallet || !walletAddress.trim()}
                  className="w-full py-2.5 bg-ghost-burgundy text-ghost-sand font-bold rounded-xl hover:bg-ghost-burgundyLight border border-ghost-sand/30 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isCheckingWallet ? (
                    <span>Verifying On-Chain Balances...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Connect Public Address</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Add Manual Holding */}
          {activeTab === 'addAsset' && (
            <form onSubmit={handleAddManualAssetSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-ghost-textMuted mb-1.5 font-semibold">Asset Symbol</label>
                  <input
                    type="text"
                    required
                    value={manualSymbol}
                    onChange={(e) => setManualSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g. BTC"
                    className="w-full bg-ghost-bg border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary uppercase focus:outline-none focus:border-ghost-sand font-bold"
                  />
                </div>

                <div>
                  <label className="block text-ghost-textMuted mb-1.5 font-semibold">Network / Location</label>
                  <input
                    type="text"
                    value={manualNetwork}
                    onChange={(e) => setManualNetwork(e.target.value)}
                    placeholder="e.g. Bitcoin"
                    className="w-full bg-ghost-bg border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary focus:outline-none focus:border-ghost-sand"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-ghost-textMuted mb-1.5 font-semibold">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={manualQuantity}
                    onChange={(e) => setManualQuantity(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-ghost-bg border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary focus:outline-none focus:border-ghost-sand"
                  />
                </div>

                <div>
                  <label className="block text-ghost-textMuted mb-1.5 font-semibold">Avg Entry Price ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={manualEntryPrice}
                    onChange={(e) => setManualEntryPrice(e.target.value)}
                    placeholder="Optional"
                    className="w-full bg-ghost-bg border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary focus:outline-none focus:border-ghost-sand"
                  />
                </div>
              </div>

              {assetFormError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs">
                  {assetFormError}
                </div>
              )}

              {assetSuccessMsg && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>{assetSuccessMsg}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-ghost-burgundy text-ghost-sand font-bold rounded-xl hover:bg-ghost-burgundyLight border border-ghost-sand/30 transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Holding</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Manage Assets */}
          {activeTab === 'manageAssets' && (
            <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {portfolio?.assets && portfolio.assets.length > 0 ? (
                portfolio.assets.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between p-3.5 bg-ghost-bg border border-ghost-border/50 rounded-xl text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-ghost-textPrimary">{a.symbol}</span>
                        <span className="text-[10px] text-ghost-textMuted bg-ghost-card border border-ghost-border px-1.5 py-0.5 rounded">
                          {a.source}
                        </span>
                      </div>
                      <span className="text-ghost-textMuted">
                        {a.quantity} {a.symbol}
                      </span>
                    </div>

                    <button
                      onClick={() => handleRemoveAsset(a.id)}
                      className="p-2 hover:bg-rose-500/15 text-ghost-textMuted hover:text-rose-400 rounded-lg transition-colors"
                      title="Remove holding"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-ghost-textMuted">
                  No individual assets recorded yet.
                </div>
              )}
            </div>
          )}
        </div>
      </Drawer>

      {/* Asset Detail Drawer */}
      <Drawer
        isOpen={selectedAsset !== null}
        onClose={() => setSelectedAsset(null)}
        title={selectedAsset ? `${selectedAsset.symbol} Position Detail` : ''}
        subtitle={selectedAsset ? `Source: ${selectedAsset.source}` : ''}
        width="max-w-md"
      >
        {selectedAsset && (
          <div className="space-y-4 text-xs">
            <div className="flex justify-between items-center py-2.5 border-b border-ghost-border/40">
              <span className="text-ghost-textMuted">Holdings Quantity</span>
              <span className="font-bold text-ghost-textPrimary">
                {selectedAsset.quantity} {selectedAsset.symbol}
              </span>
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-ghost-border/40">
              <span className="text-ghost-textMuted">Current Market Price</span>
              <span className="font-bold text-ghost-textPrimary">
                {priceMap[selectedAsset.symbol] ? formatVal(priceMap[selectedAsset.symbol] || 0) : 'Price unavailable'}
              </span>
            </div>

            <div className="flex justify-between items-center py-2.5 border-b border-ghost-border/40">
              <span className="text-ghost-textMuted">Estimated Total Value</span>
              <span className="font-bold text-ghost-sand text-sm">
                {priceMap[selectedAsset.symbol]
                  ? formatVal(selectedAsset.quantity * (priceMap[selectedAsset.symbol] || 0))
                  : 'Unavailable'}
              </span>
            </div>

            {selectedAsset.avg_entry_price > 0 && (
              <>
                <div className="flex justify-between items-center py-2.5 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Average Entry Price</span>
                  <span className="text-ghost-textPrimary">{formatVal(selectedAsset.avg_entry_price)}</span>
                </div>

                <div className="flex justify-between items-center py-2.5 border-b border-ghost-border/40">
                  <span className="text-ghost-textMuted">Unrealized P/L</span>
                  <span
                    className={`font-bold ${
                      (priceMap[selectedAsset.symbol] || 0) >= selectedAsset.avg_entry_price
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {priceMap[selectedAsset.symbol]
                      ? formatVal(
                          selectedAsset.quantity * (priceMap[selectedAsset.symbol] || 0) -
                            selectedAsset.quantity * selectedAsset.avg_entry_price
                        )
                      : 'N/A'}
                  </span>
                </div>
              </>
            )}

            <div className="flex justify-between items-center py-2.5 border-b border-ghost-border/40">
              <span className="text-ghost-textMuted">Network / Chain</span>
              <span className="text-ghost-textPrimary">{selectedAsset.network || 'Mainnet'}</span>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setSelectedAsset(null)}
                className="px-4 py-2 bg-ghost-card hover:bg-ghost-cardHover border border-ghost-border text-ghost-textPrimary font-semibold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default PortfolioRisk;
