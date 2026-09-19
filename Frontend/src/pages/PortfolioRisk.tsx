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
  Edit3, 
  Trash2, 
  X, 
  Check, 
  Info, 
  Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await portfolioService.refreshAllWallets();
      await fetchPortfolioData();
    } catch (err) {
      setError('Unable to update wallet balances right now.');
      setIsRefreshing(false);
    }
  };

  // Calculations for total value and individual asset valuations
  const enrichedAssets = useMemo(() => {
    if (!portfolio?.assets) return [];

    // Grouping assets by symbol for total portfolio aggregation
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
    } catch (err) {
      setError('Failed to remove wallet.');
    }
  };

  const handleRemoveAsset = async (assetId: string) => {
    try {
      await portfolioService.removeAsset(assetId);
      await fetchPortfolioData();
    } catch (err) {
      setError('Failed to remove asset holding.');
    }
  };

  const shortenAddress = (addr: string) => {
    if (!addr || addr.length < 10) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center text-ghost-textMuted font-mono text-sm animate-pulse">
        Loading portfolio and live market data...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-16 animate-in fade-in duration-500">
      
      {/* Header & Portfolio Total */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-semibold text-ghost-textDim uppercase tracking-wider block">
              Your Portfolio Value
            </span>
            
            {/* Currency Mode Selector Pill */}
            <div className="inline-flex bg-ghost-darkest border border-ghost-border p-0.5 rounded-lg text-[11px] font-mono">
              <button
                onClick={() => setCurrencyMode('USD')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  currencyMode === 'USD' ? 'bg-ghost-cyan text-ghost-darkest font-bold' : 'text-ghost-textMuted hover:text-ghost-textPrimary'
                }`}
              >
                USD ($)
              </button>
              <button
                onClick={() => setCurrencyMode('INR')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  currencyMode === 'INR' ? 'bg-ghost-cyan text-ghost-darkest font-bold' : 'text-ghost-textMuted hover:text-ghost-textPrimary'
                }`}
              >
                INR (₹)
              </button>
              <button
                onClick={() => setCurrencyMode('BOTH')}
                className={`px-2 py-0.5 rounded-md transition-colors ${
                  currencyMode === 'BOTH' ? 'bg-ghost-cyan text-ghost-darkest font-bold' : 'text-ghost-textMuted hover:text-ghost-textPrimary'
                }`}
              >
                Both ($/₹)
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex items-baseline gap-4">
              <h1 className="text-4xl font-bold font-mono text-ghost-textPrimary tracking-tight">
                {currencyMode === 'INR' ? (
                  `₹${totalPortfolioValueINR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                ) : (
                  `$${totalPortfolioValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                )}
              </h1>
              {totalPortfolioValueUSD > 0 && (
                <span className="text-emerald-400 text-sm font-medium bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
                  +2.40% today
                </span>
              )}
            </div>

            {/* Secondary Currency Display when BOTH mode is active */}
            {currencyMode === 'BOTH' && totalPortfolioValueUSD > 0 && (
              <span className="text-sm font-mono text-ghost-cyan mt-1">
                ≈ ₹{totalPortfolioValueINR.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} INR
              </span>
            )}
          </div>

          <p className="text-xs text-ghost-textMuted mt-1.5 flex items-center gap-2">
            <span>Last updated {Math.round((new Date().getTime() - lastRefreshedAt.getTime()) / 1000)}s ago</span>
            <span>•</span>
            <span className="text-ghost-cyan font-medium">1 USD = ₹{USD_TO_INR.toFixed(2)} INR</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="px-4 py-2 bg-ghost-card border border-ghost-border rounded-xl text-ghost-textPrimary text-sm font-medium hover:bg-ghost-border/40 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh balances'}</span>
          </button>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="px-4 py-2 bg-ghost-cyan text-ghost-darkest text-sm font-semibold rounded-xl hover:bg-ghost-cyan/90 transition-colors flex items-center gap-2 shadow-lg shadow-ghost-cyan/10"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit portfolio</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={handleRefreshAll} className="underline text-xs font-semibold">Try again</button>
        </div>
      )}

      {/* Main Grid Content */}
      {enrichedAssets.length === 0 ? (
        /* Empty State */
        <div className="bg-ghost-card border border-ghost-border rounded-2xl p-12 text-center my-8 shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-ghost-darkest border border-ghost-border flex items-center justify-center mx-auto mb-4 text-ghost-cyan">
            <WalletIcon className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-ghost-textPrimary mb-2">Your portfolio is empty</h2>
          <p className="text-sm text-ghost-textMuted max-w-md mx-auto mb-6">
            Connect a public wallet or add your first manual holding to start tracking your real crypto investment portfolio.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => { setActiveTab('addWallet'); setIsEditModalOpen(true); }}
              className="px-5 py-2.5 bg-ghost-cyan text-ghost-darkest font-semibold text-sm rounded-xl hover:bg-ghost-cyan/90 transition-colors flex items-center gap-2"
            >
              <WalletIcon className="w-4 h-4" />
              <span>Add wallet</span>
            </button>
            <button
              onClick={() => { setActiveTab('addAsset'); setIsEditModalOpen(true); }}
              className="px-5 py-2.5 bg-ghost-darkest border border-ghost-border text-ghost-textPrimary font-semibold text-sm rounded-xl hover:bg-ghost-border/40 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add asset</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left 2 Cols: Assets & Allocation */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Allocation Bar */}
            <div className="bg-ghost-card border border-ghost-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-ghost-cyan" />
                  <h2 className="text-lg font-bold text-ghost-textPrimary">Portfolio Allocation</h2>
                </div>
                <span className="text-xs text-ghost-textMuted font-mono">{enrichedAssets.length} Assets</span>
              </div>

              {/* Progress Bar */}
              <div className="h-3 flex rounded-full overflow-hidden mb-6 bg-ghost-darkest p-0.5 border border-ghost-border/30">
                {enrichedAssets.map((a, i) => (
                  <div
                    key={a.symbol}
                    style={{ width: `${Math.max(a.allocation, 2)}%` }}
                    className={`h-full ${
                      i === 0 ? 'bg-ghost-cyan' : i === 1 ? 'bg-emerald-400' : i === 2 ? 'bg-amber-400' : 'bg-purple-400'
                    }`}
                  />
                ))}
              </div>

              {/* Assets Breakdown Table */}
              <div className="space-y-3">
                {enrichedAssets.map((a, i) => (
                  <div
                    key={a.symbol}
                    onClick={() => {
                      const orig = portfolio?.assets.find(item => item.symbol.toUpperCase() === a.symbol);
                      if (orig) setSelectedAsset(orig);
                    }}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-ghost-darkest/60 border border-transparent hover:border-ghost-border/40 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-full ${
                        i === 0 ? 'bg-ghost-cyan' : i === 1 ? 'bg-emerald-400' : i === 2 ? 'bg-amber-400' : 'bg-purple-400'
                      }`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ghost-textPrimary group-hover:text-ghost-cyan transition-colors">{a.symbol}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold tracking-wider ${
                            a.sourcesList.includes('Wallet') ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {a.sourcesList}
                          </span>
                        </div>
                        <span className="text-xs text-ghost-textMuted font-mono">
                          {a.quantity.toLocaleString(undefined, { maximumFractionDigits: 6 })} {a.symbol}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono font-bold text-ghost-textPrimary text-sm">
                        {formatVal(a.usdValue)}
                      </div>
                      <div className="text-xs font-mono text-ghost-textMuted">
                        {a.allocation.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Connected Wallets List */}
            <div className="bg-ghost-card border border-ghost-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <WalletIcon className="w-5 h-5 text-ghost-cyan" />
                  <h2 className="text-lg font-bold text-ghost-textPrimary">My Wallets</h2>
                </div>
                <button
                  onClick={() => { setActiveTab('addWallet'); setIsEditModalOpen(true); }}
                  className="text-xs text-ghost-cyan hover:underline font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Connect wallet</span>
                </button>
              </div>

              {portfolio?.wallets && portfolio.wallets.length > 0 ? (
                <div className="space-y-3">
                  {portfolio.wallets.map((w) => (
                    <div key={w.id} className="flex items-center justify-between p-3.5 bg-ghost-darkest/50 border border-ghost-border/40 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-ghost-card border border-ghost-border flex items-center justify-center text-xs font-bold text-ghost-cyan">
                          {w.network.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-ghost-textPrimary text-sm">{w.label || w.network}</span>
                            <span className="text-xs font-mono text-ghost-textMuted bg-ghost-border/40 px-2 py-0.5 rounded">
                              {shortenAddress(w.address)}
                            </span>
                          </div>
                          <span className="text-xs text-ghost-textMuted">
                            {w.asset_count} assets detected on {w.network}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => portfolioService.refreshWallet(w.id).then(fetchPortfolioData)}
                          className="p-2 hover:bg-ghost-border/50 text-ghost-textMuted hover:text-ghost-textPrimary rounded-lg transition-colors"
                          title="Refresh wallet balances"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemoveWallet(w.id)}
                          className="p-2 hover:bg-rose-500/10 text-ghost-textMuted hover:text-rose-400 rounded-lg transition-colors"
                          title="Remove wallet"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-ghost-textMuted border border-dashed border-ghost-border/60 rounded-xl">
                  No read-only wallets connected yet.
                </div>
              )}
            </div>

          </div>

          {/* Right Col: Risk & Fast Actions */}
          <div className="space-y-8">
            
            {/* Risk Assessment */}
            <div className="bg-ghost-card border border-ghost-border rounded-2xl p-6 shadow-sm flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="w-5 h-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-ghost-textPrimary">Portfolio Risk</h2>
              </div>

              {riskResult ? (
                <div className="space-y-4 flex-1">
                  <div className="flex justify-between items-center pb-3 border-b border-ghost-border/40">
                    <span className="text-sm text-ghost-textMuted">Overall risk</span>
                    <span className={`font-semibold text-sm ${
                      riskResult.overall_risk_score > 70 ? 'text-rose-400' : riskResult.overall_risk_score > 40 ? 'text-amber-400' : 'text-emerald-400'
                    }`}>
                      {riskResult.overall_risk_score > 70 ? 'High Risk' : riskResult.overall_risk_score > 40 ? 'Moderate' : 'Low Risk'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b border-ghost-border/40">
                    <span className="text-sm text-ghost-textMuted">Largest holding</span>
                    <span className="font-semibold text-sm text-ghost-textPrimary">
                      {enrichedAssets[0]?.symbol || 'None'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b border-ghost-border/40">
                    <span className="text-sm text-ghost-textMuted">Concentration</span>
                    <span className="font-semibold text-sm text-ghost-textPrimary">
                      {enrichedAssets[0] ? `${enrichedAssets[0].allocation.toFixed(0)}%` : '0%'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pb-3 border-b border-ghost-border/40">
                    <span className="text-sm text-ghost-textMuted">Daily VaR (95%)</span>
                    <span className="font-mono font-medium text-sm text-ghost-textPrimary">
                      {(riskResult.portfolio_var_95_daily * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-ghost-textMuted flex flex-col items-center justify-center">
                  <Info className="w-6 h-6 mb-2 opacity-40" />
                  Add holdings to calculate real-time portfolio risk.
                </div>
              )}

              <button
                onClick={() => navigate('/research')}
                className="w-full mt-6 py-2.5 rounded-xl border border-ghost-border text-ghost-textPrimary hover:bg-ghost-border/40 transition-colors text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <span>View risk analysis</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Helper Card */}
            <div className="bg-gradient-to-br from-ghost-card to-ghost-darkest border border-ghost-border/60 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center gap-2 text-ghost-cyan font-bold text-xs uppercase tracking-wider mb-2">
                <Sparkles className="w-4 h-4" />
                <span>Security Notice</span>
              </div>
              <p className="text-xs text-ghost-textMuted leading-relaxed">
                GHOST uses read-only public address tracking. We will <strong>never</strong> ask for private keys, seed phrases, or password credentials.
              </p>
            </div>

          </div>

        </div>
      )}

      {/* Edit Portfolio Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ghost-card border border-ghost-border rounded-2xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-ghost-border">
              <h3 className="text-lg font-bold text-ghost-textPrimary">Edit Portfolio</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="p-1 hover:bg-ghost-border/50 text-ghost-textMuted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-ghost-border/60 my-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('addWallet')}
                className={`py-2 px-4 border-b-2 transition-colors ${
                  activeTab === 'addWallet' ? 'border-ghost-cyan text-ghost-cyan' : 'border-transparent text-ghost-textMuted hover:text-ghost-textPrimary'
                }`}
              >
                Add Wallet
              </button>
              <button
                onClick={() => setActiveTab('addAsset')}
                className={`py-2 px-4 border-b-2 transition-colors ${
                  activeTab === 'addAsset' ? 'border-ghost-cyan text-ghost-cyan' : 'border-transparent text-ghost-textMuted hover:text-ghost-textPrimary'
                }`}
              >
                Add Manual Holding
              </button>
              <button
                onClick={() => setActiveTab('manageAssets')}
                className={`py-2 px-4 border-b-2 transition-colors ${
                  activeTab === 'manageAssets' ? 'border-ghost-cyan text-ghost-cyan' : 'border-transparent text-ghost-textMuted hover:text-ghost-textPrimary'
                }`}
              >
                Manage Assets
              </button>
            </div>

            {/* TAB 1: Add Public Wallet */}
            {activeTab === 'addWallet' && (
              <form onSubmit={handleAddWalletSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-ghost-textMuted mb-1 font-medium">Select Network</label>
                  <select
                    value={walletNetwork}
                    onChange={(e) => setWalletNetwork(e.target.value)}
                    className="w-full bg-ghost-darkest border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary focus:outline-none focus:border-ghost-cyan"
                  >
                    {SUPPORTED_NETWORKS.map((net) => (
                      <option key={net.name} value={net.name}>{net.name} ({net.symbol})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-ghost-textMuted mb-1 font-medium">Public Wallet Address</label>
                  <input
                    type="text"
                    required
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    placeholder={SUPPORTED_NETWORKS.find(n => n.name === walletNetwork)?.placeholder || '0x...'}
                    className="w-full bg-ghost-darkest border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary font-mono placeholder:text-ghost-textMuted/50 focus:outline-none focus:border-ghost-cyan"
                  />
                  <span className="text-[11px] text-ghost-textMuted mt-1 block">
                    Example: {SUPPORTED_NETWORKS.find(n => n.name === walletNetwork)?.example}
                  </span>
                </div>

                <div>
                  <label className="block text-ghost-textMuted mb-1 font-medium">Wallet Label (Optional)</label>
                  <input
                    type="text"
                    value={walletLabel}
                    onChange={(e) => setWalletLabel(e.target.value)}
                    placeholder="e.g. Main Cold Storage"
                    className="w-full bg-ghost-darkest border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary focus:outline-none focus:border-ghost-cyan"
                  />
                </div>

                {walletCheckError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-mono">
                    {walletCheckError}
                  </div>
                )}

                {walletSuccessMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-mono flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>{walletSuccessMsg}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isCheckingWallet || !walletAddress.trim()}
                    className="w-full py-2.5 bg-ghost-cyan text-ghost-darkest font-semibold rounded-xl hover:bg-ghost-cyan/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isCheckingWallet ? (
                      <span>Verifying & Fetching Balances...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Add to portfolio</span>
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
                    <label className="block text-ghost-textMuted mb-1 font-medium">Asset Symbol</label>
                    <input
                      type="text"
                      required
                      value={manualSymbol}
                      onChange={(e) => setManualSymbol(e.target.value.toUpperCase())}
                      placeholder="e.g. BTC, ETH, SOL"
                      className="w-full bg-ghost-darkest border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary font-mono uppercase focus:outline-none focus:border-ghost-cyan"
                    />
                  </div>

                  <div>
                    <label className="block text-ghost-textMuted mb-1 font-medium">Network Label</label>
                    <input
                      type="text"
                      value={manualNetwork}
                      onChange={(e) => setManualNetwork(e.target.value)}
                      placeholder="e.g. Bitcoin, Solana"
                      className="w-full bg-ghost-darkest border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary focus:outline-none focus:border-ghost-cyan"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-ghost-textMuted mb-1 font-medium">Quantity</label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={manualQuantity}
                      onChange={(e) => setManualQuantity(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-ghost-darkest border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary font-mono focus:outline-none focus:border-ghost-cyan"
                    />
                  </div>

                  <div>
                    <label className="block text-ghost-textMuted mb-1 font-medium">Avg Entry Price (USD)</label>
                    <input
                      type="number"
                      step="any"
                      value={manualEntryPrice}
                      onChange={(e) => setManualEntryPrice(e.target.value)}
                      placeholder="Optional"
                      className="w-full bg-ghost-darkest border border-ghost-border rounded-xl p-2.5 text-ghost-textPrimary font-mono focus:outline-none focus:border-ghost-cyan"
                    />
                  </div>
                </div>

                {assetFormError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-mono">
                    {assetFormError}
                  </div>
                )}

                {assetSuccessMsg && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-mono flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    <span>{assetSuccessMsg}</span>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-ghost-cyan text-ghost-darkest font-semibold rounded-xl hover:bg-ghost-cyan/90 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add manual holding</span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 3: Manage Assets */}
            {activeTab === 'manageAssets' && (
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {portfolio?.assets && portfolio.assets.length > 0 ? (
                  portfolio.assets.map(a => (
                    <div key={a.id} className="flex items-center justify-between p-3 bg-ghost-darkest/50 border border-ghost-border/40 rounded-xl text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ghost-textPrimary">{a.symbol}</span>
                          <span className="text-[10px] text-ghost-textMuted bg-ghost-border/40 px-1.5 py-0.5 rounded">
                            {a.source}
                          </span>
                        </div>
                        <span className="font-mono text-ghost-textMuted">{a.quantity} {a.symbol}</span>
                      </div>

                      <button
                        onClick={() => handleRemoveAsset(a.id)}
                        className="p-1.5 hover:bg-rose-500/10 text-ghost-textMuted hover:text-rose-400 rounded-lg transition-colors"
                        title="Remove holding"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center text-xs text-ghost-textMuted">No assets to manage.</div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* Asset Detail View Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ghost-card border border-ghost-border rounded-2xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-ghost-border mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-ghost-darkest border border-ghost-border flex items-center justify-center font-bold text-ghost-cyan">
                  {selectedAsset.symbol.slice(0, 3)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-ghost-textPrimary">{selectedAsset.symbol} Details</h3>
                  <span className="text-xs text-ghost-textMuted font-mono">Source: {selectedAsset.source}</span>
                </div>
              </div>
              <button onClick={() => setSelectedAsset(null)} className="p-1 hover:bg-ghost-border/50 text-ghost-textMuted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-2 border-b border-ghost-border/40">
                <span className="text-ghost-textMuted">Quantity</span>
                <span className="font-mono font-bold text-ghost-textPrimary">{selectedAsset.quantity} {selectedAsset.symbol}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-ghost-border/40">
                <span className="text-ghost-textMuted">Current Market Price</span>
                <span className="font-mono font-bold text-ghost-textPrimary">
                  {priceMap[selectedAsset.symbol] ? formatVal(priceMap[selectedAsset.symbol] || 0) : 'Price unavailable'}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-ghost-border/40">
                <span className="text-ghost-textMuted">Estimated Total Value</span>
                <span className="font-mono font-bold text-ghost-cyan text-sm">
                  {priceMap[selectedAsset.symbol] ? formatVal(selectedAsset.quantity * (priceMap[selectedAsset.symbol] || 0)) : 'Unavailable'}
                </span>
              </div>

              {selectedAsset.avg_entry_price > 0 && (
                <>
                  <div className="flex justify-between items-center py-2 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Average Entry Price</span>
                    <span className="font-mono text-ghost-textPrimary">{formatVal(selectedAsset.avg_entry_price)}</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Unrealized P/L</span>
                    <span className={`font-mono font-bold ${
                      (priceMap[selectedAsset.symbol] || 0) >= selectedAsset.avg_entry_price ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {priceMap[selectedAsset.symbol] ? (
                        formatVal((selectedAsset.quantity * (priceMap[selectedAsset.symbol] || 0)) - (selectedAsset.quantity * selectedAsset.avg_entry_price))
                      ) : 'N/A'}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between items-center py-2 border-b border-ghost-border/40">
                <span className="text-ghost-textMuted">Network / Provider</span>
                <span className="font-mono text-ghost-textPrimary">{selectedAsset.network || 'Mainnet'}</span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-ghost-border flex justify-end">
              <button
                onClick={() => setSelectedAsset(null)}
                className="px-4 py-2 bg-ghost-darkest border border-ghost-border text-ghost-textPrimary font-semibold rounded-xl hover:bg-ghost-border/40 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
