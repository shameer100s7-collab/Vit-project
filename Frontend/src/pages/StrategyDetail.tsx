import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Play,
  Pause,
  RefreshCw,
  ExternalLink,
  Lock,
  Cpu,
  AlertTriangle,
  Database,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Activity,
  ArrowLeft,
} from 'lucide-react';
import { strategiesApi, marketApi } from '../api';
import {
  StrategyItem,
  BacktestResult,
  PaperTradingStatus,
  OnChainProof,
  StrategyVerificationResult,
  CanonicalPrice,
  CanonicalVolume,
} from '../types';

export const StrategyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Core entities
  const [strategy, setStrategy] = useState<StrategyItem | null>(null);
  const [backtest, setBacktest] = useState<BacktestResult | null>(null);
  const [paperStatus, setPaperStatus] = useState<PaperTradingStatus | null>(null);
  const [onchainProof, setOnchainProof] = useState<OnChainProof | null>(null);
  const [verification, setVerification] = useState<StrategyVerificationResult | null>(null);

  // Live Exchange Telemetry
  const [livePrice, setLivePrice] = useState<CanonicalPrice | null>(null);
  const [liveVolume, setLiveVolume] = useState<CanonicalVolume | null>(null);
  const [lastMarketUpdate, setLastMarketUpdate] = useState<number>(Date.now());

  // Action / Loading States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBacktesting, setIsBacktesting] = useState<boolean>(false);
  const [isRegisteringOnChain, setIsRegisteringOnChain] = useState<boolean>(false);
  const [isPaperActionLoading, setIsPaperActionLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);

  // 1. Initial Load
  const loadStrategyData = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const [strat, bt, paper, proof, verif] = await Promise.all([
        strategiesApi.get(id),
        strategiesApi.getLatestBacktest(id).catch(() => null),
        strategiesApi.getPaperTradingStatus(id).catch(() => null),
        strategiesApi.getOnChainProof(id).catch(() => null),
        strategiesApi.getVerification(id).catch(() => null),
      ]);

      setStrategy(strat);
      setBacktest(bt);
      setPaperStatus(paper);
      setOnchainProof(proof);
      setVerification(verif);

      // Fetch live market data for strategy asset
      if (strat?.asset) {
        try {
          const [pRes, vRes] = await Promise.all([
            marketApi.getPrice(strat.asset),
            marketApi.getVolume(strat.asset).catch(() => null),
          ]);
          setLivePrice(pRes.data);
          if (vRes) setLiveVolume(vRes.data);
          setLastMarketUpdate(Date.now());
        } catch {
          // Handled gracefully in live market panel
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load strategy details.');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadStrategyData();
  }, [loadStrategyData]);

  // 2. Periodic Live Price Poll
  useEffect(() => {
    if (!strategy?.asset) return;
    const interval = setInterval(async () => {
      try {
        const pRes = await marketApi.getPrice(strategy.asset);
        setLivePrice(pRes.data);
        setLastMarketUpdate(Date.now());

        // If paper trading is active, evaluate simulated tick
        if (paperStatus?.is_active && id) {
          const updatedPaper = await strategiesApi.evaluatePaperTradingTick(id);
          setPaperStatus(updatedPaper);
        }
      } catch {
        // Suppress background poll errors
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [strategy?.asset, paperStatus?.is_active, id]);

  // 3. Trigger Real Backtest
  const handleRunBacktest = async () => {
    if (!id) return;
    setIsBacktesting(true);
    setErrorMessage(null);
    try {
      const res = await strategiesApi.runBacktest(id, {
        limit: 180,
        initial_capital: 10000.0,
      });
      setBacktest(res);
      // Refresh verification dashboard automatically
      const updatedVerif = await strategiesApi.getVerification(id);
      setVerification(updatedVerif);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Backtest execution failed.');
    } finally {
      setIsBacktesting(false);
    }
  };

  // 4. Register On-Chain
  const handleRegisterOnChain = async () => {
    if (!id) return;
    setIsRegisteringOnChain(true);
    setErrorMessage(null);
    try {
      const proof = await strategiesApi.registerOnChain(id);
      setOnchainProof(proof);
      if (strategy) {
        setStrategy({
          ...strategy,
          is_onchain: true,
          tx_hash: proof.transaction_hash,
          contract_address: proof.contract_address,
          block_number: proof.block_number,
        });
      }
      const updatedVerif = await strategiesApi.getVerification(id);
      setVerification(updatedVerif);
    } catch (err: any) {
      setErrorMessage(err?.message || 'On-chain registration failed.');
    } finally {
      setIsRegisteringOnChain(false);
    }
  };

  // 5. Toggle Paper Trading
  const handleTogglePaperTrading = async () => {
    if (!id || !strategy) return;
    setIsPaperActionLoading(true);
    try {
      if (paperStatus?.is_active) {
        const res = await strategiesApi.stopPaperTrading(id);
        setPaperStatus(res);
      } else {
        const res = await strategiesApi.startPaperTrading(id);
        setPaperStatus(res);
      }
      const updatedVerif = await strategiesApi.getVerification(id);
      setVerification(updatedVerif);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Paper trading action failed.');
    } finally {
      setIsPaperActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center text-xs text-ghost-textMuted flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-ghost-sand" />
        <span>Loading strategy telemetry & blockchain verification...</span>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
        <h2 className="text-base font-bold text-ghost-textPrimary">Strategy Not Found</h2>
        <button
          onClick={() => navigate('/strategies')}
          className="px-4 py-2 rounded-xl bg-ghost-card border border-ghost-border text-xs font-semibold"
        >
          Return to Registry
        </button>
      </div>
    );
  }

  const badge = verification?.badge || strategy.verification_badge || 'INSUFFICIENT_DATA';
  const badgeColors: Record<string, { label: string; cls: string; dot: string }> = {
    VERIFIED: {
      label: '🟢 VERIFIED',
      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
      dot: 'bg-emerald-400',
    },
    PARTIALLY_VERIFIED: {
      label: '🟡 PARTIALLY VERIFIED',
      cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
      dot: 'bg-amber-400',
    },
    ANOMALY_DETECTED: {
      label: '🔴 ANOMALY DETECTED',
      cls: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
      dot: 'bg-rose-400',
    },
    UNDER_REVIEW: {
      label: '🔵 UNDER REVIEW',
      cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40',
      dot: 'bg-blue-400',
    },
    INSUFFICIENT_DATA: {
      label: '⚪ INSUFFICIENT DATA',
      cls: 'bg-ghost-border/40 text-ghost-textMuted border-ghost-border',
      dot: 'bg-ghost-textMuted',
    },
  };
  const activeBadge = badgeColors[badge] || badgeColors.INSUFFICIENT_DATA;

  const secondsAgo = Math.max(0, Math.round((Date.now() - lastMarketUpdate) / 1000));

  // Render SVG Equity Curve
  const renderEquityCurve = () => {
    if (!backtest?.equity_curve || backtest.equity_curve.length < 2) {
      return (
        <div className="h-44 flex items-center justify-center text-xs text-ghost-textMuted border border-dashed border-ghost-border/70 rounded-xl">
          Run backtest to generate real equity curve.
        </div>
      );
    }

    const points = backtest.equity_curve;
    const equities = points.map((p) => p.equity);
    const minEq = Math.min(...equities);
    const maxEq = Math.max(...equities);
    const range = maxEq - minEq || 1;

    const width = 600;
    const height = 150;
    const padding = 15;

    const svgPoints = points
      .map((p, i) => {
        const x = padding + (i / (points.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((p.equity - minEq) / range) * (height - 2 * padding);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    const isPositive = (equities[equities.length - 1] ?? 0) >= (equities[0] ?? 0);
    const strokeColor = isPositive ? '#34d399' : '#f87171';

    return (
      <div className="space-y-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44 overflow-visible">
          <polyline
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={svgPoints}
          />
        </svg>
        <div className="flex items-center justify-between text-[10px] text-ghost-textMuted font-mono">
          <span>{backtest.start_date.slice(0, 10)}</span>
          <span>Min: ${minEq.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span>Max: ${maxEq.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span>{backtest.end_date.slice(0, 10)}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-xs">
      {/* Top Header & Back Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/strategies')}
              className="p-1.5 rounded-lg bg-ghost-card border border-ghost-border hover:text-ghost-sand text-ghost-textMuted transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
              {strategy.name}
            </h1>
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${activeBadge.cls}`}
            >
              <span>{activeBadge.label}</span>
            </span>
          </div>
          <p className="text-xs text-ghost-textMuted pl-9">
            Deterministic cryptographic verification report and real-time market provenance.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 pl-9 sm:pl-0">
          <button
            onClick={handleRunBacktest}
            disabled={isBacktesting}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ghost-card border border-ghost-border hover:border-ghost-sand/60 text-ghost-textPrimary font-semibold transition-all disabled:opacity-50"
          >
            <Play className={`w-3.5 h-3.5 ${isBacktesting ? 'animate-spin' : ''}`} />
            <span>{isBacktesting ? 'Executing Backtest...' : 'Run Historical Backtest'}</span>
          </button>

          {!onchainProof?.is_verified && (
            <button
              onClick={handleRegisterOnChain}
              disabled={isRegisteringOnChain}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold border border-ghost-sand/30 hover:bg-[#6c1219] shadow transition-all disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isRegisteringOnChain ? 'Registering on EVM...' : 'Register On-Chain'}</span>
            </button>
          )}

          <button
            onClick={handleTogglePaperTrading}
            disabled={isPaperActionLoading}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl font-semibold border transition-all ${
              paperStatus?.is_active
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
            }`}
          >
            {paperStatus?.is_active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{paperStatus?.is_active ? 'Stop Paper Trading' : 'Start Live Paper Trading'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 font-bold ml-4">
            ✕
          </button>
        </div>
      )}

      {/* SECTION 1: STRATEGY VERIFICATION STATUS MATRIX */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-ghost-card border border-ghost-border space-y-1">
          <span className="text-[10px] text-ghost-textMuted uppercase font-bold block">
            ON-CHAIN STATUS
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                onchainProof?.is_verified ? 'bg-emerald-400' : 'bg-ghost-textMuted'
              }`}
            />
            <strong className="text-xs font-semibold text-ghost-textPrimary">
              {onchainProof?.is_verified ? 'REGISTERED' : 'NOT REGISTERED'}
            </strong>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-ghost-card border border-ghost-border space-y-1">
          <span className="text-[10px] text-ghost-textMuted uppercase font-bold block">
            BACKTEST STATUS
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                backtest?.performance ? 'bg-emerald-400' : 'bg-ghost-textMuted'
              }`}
            />
            <strong className="text-xs font-semibold text-ghost-textPrimary">
              {backtest?.performance ? 'COMPLETED' : 'NOT RUN'}
            </strong>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-ghost-card border border-ghost-border space-y-1">
          <span className="text-[10px] text-ghost-textMuted uppercase font-bold block">
            PAPER TRADING
          </span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                paperStatus?.is_active ? 'bg-emerald-400 animate-pulse' : 'bg-ghost-textMuted'
              }`}
            />
            <strong className="text-xs font-semibold text-ghost-textPrimary">
              {paperStatus?.is_active ? 'ACTIVE' : 'INACTIVE'}
            </strong>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-ghost-card border border-ghost-border space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-ghost-textMuted uppercase font-bold">
              VERIFICATION SCORE
            </span>
            {verification?.score !== null && verification?.score !== undefined && (
              <button
                onClick={() => setShowScoreModal(true)}
                className="text-[10px] text-ghost-sand hover:underline font-semibold"
              >
                WHY?
              </button>
            )}
          </div>
          <strong className="text-sm font-mono text-ghost-sand block">
            {verification?.score !== null && verification?.score !== undefined
              ? `${Math.round(verification.score)} / 100`
              : 'N/A'}
          </strong>
        </div>
      </div>

      {/* SECTION 2: LIVE MARKET DATA + ON-CHAIN PROOF (2 COLUMNS) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LIVE MARKET DATA */}
        <div className="bg-ghost-card border border-ghost-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-ghost-border">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <h2 className="text-xs font-bold text-ghost-textPrimary uppercase tracking-wider">
                LIVE MARKET DATA
              </h2>
            </div>
            <span className="text-[10px] text-ghost-textMuted font-mono">
              {secondsAgo < 2 ? 'Live Stream' : `Updated ${secondsAgo}s ago`}
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-[10px] text-ghost-textMuted uppercase">Target Asset</span>
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-ghost-textPrimary font-mono">
                  {strategy.asset}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-ghost-bg border border-ghost-border text-ghost-textMuted">
                  Binance Spot
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-ghost-bg border border-ghost-border/80 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-ghost-textMuted uppercase block">Current Price</span>
                <span className="text-xl font-bold font-mono text-ghost-sand">
                  {livePrice?.price
                    ? `$${livePrice.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                    : 'MARKET DATA TEMPORARILY UNAVAILABLE'}
                </span>
              </div>
              {liveVolume?.price_change_pct_24h !== undefined && (
                <div
                  className={`flex items-center gap-1 font-mono font-bold text-xs ${
                    liveVolume.price_change_pct_24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {liveVolume.price_change_pct_24h >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {liveVolume.price_change_pct_24h > 0 ? '+' : ''}
                    {liveVolume.price_change_pct_24h.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="p-2.5 rounded-lg bg-ghost-bg border border-ghost-border/40">
                <span className="text-[10px] text-ghost-textMuted block">24h Volume</span>
                <span>
                  {liveVolume?.volume_24h
                    ? `${liveVolume.volume_24h.toLocaleString(undefined, { maximumFractionDigits: 1 })}`
                    : '—'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-ghost-bg border border-ghost-border/40">
                <span className="text-[10px] text-ghost-textMuted block">Timeframe</span>
                <span>{strategy.timeframe.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ON-CHAIN PROOF */}
        <div className="lg:col-span-2 bg-ghost-card border border-ghost-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-ghost-border">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-ghost-sand" />
              <h2 className="text-xs font-bold text-ghost-textPrimary uppercase tracking-wider">
                ON-CHAIN PROOF & CRYPTOGRAPHIC FOOTPRINT
              </h2>
            </div>
            {onchainProof?.explorer_url && (
              <a
                href={onchainProof.explorer_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ghost-burgundy/40 border border-ghost-sand/30 text-ghost-sand hover:text-white font-semibold text-[11px] transition-colors"
              >
                <span>VERIFY ON BLOCKCHAIN</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="space-y-1">
              <span className="text-[10px] text-ghost-textMuted uppercase font-sans">
                Cryptographic Strategy Hash (SHA-256)
              </span>
              <div className="p-2 rounded-lg bg-ghost-bg border border-ghost-border text-ghost-sand select-all break-all text-[11px]">
                {strategy.strategy_hash}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-ghost-textMuted uppercase font-sans">
                Deterministic IPFS CIDv1
              </span>
              <div className="p-2 rounded-lg bg-ghost-bg border border-ghost-border text-ghost-textPrimary select-all break-all text-[11px]">
                {strategy.ipfs_cid || 'bafkrei...'}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-ghost-textMuted uppercase font-sans">
                Blockchain Network
              </span>
              <div className="p-2 rounded-lg bg-ghost-bg border border-ghost-border text-ghost-textPrimary">
                {onchainProof?.blockchain_network || 'Ethereum Sepolia (ChainID: 11155111)'}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-ghost-textMuted uppercase font-sans">
                Smart Contract Registry Address
              </span>
              <div className="p-2 rounded-lg bg-ghost-bg border border-ghost-border text-ghost-textPrimary select-all break-all text-[11px]">
                {onchainProof?.contract_address || '0x8E192f16C2E2aB3f14A47E53DdB5683935393a55'}
              </div>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <span className="text-[10px] text-ghost-textMuted uppercase font-sans">
                Transaction Hash & Block
              </span>
              <div className="p-2.5 rounded-lg bg-ghost-bg border border-ghost-border flex flex-wrap items-center justify-between gap-2">
                <span className="text-ghost-sand select-all break-all text-[11px]">
                  {onchainProof?.transaction_hash || 'ON-CHAIN STATUS: NOT REGISTERED'}
                </span>
                {onchainProof?.block_number && (
                  <span className="px-2 py-0.5 rounded bg-ghost-card border border-ghost-border text-[10px] text-ghost-textMuted">
                    Block #{onchainProof.block_number}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: BACKTEST PERFORMANCE & EQUITY CURVE */}
      <div className="bg-ghost-card border border-ghost-border rounded-2xl p-5 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ghost-border">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-ghost-sand" />
            <h2 className="text-xs font-bold text-ghost-textPrimary uppercase tracking-wider">
              REAL BACKTEST PERFORMANCE (BINANCE SPOT OHLCV)
            </h2>
          </div>
          {backtest && (
            <span className="text-[11px] font-mono text-ghost-textMuted">
              Run ID: <strong className="text-ghost-sand">{backtest.backtest_run_id}</strong> (
              {backtest.candle_count} candles)
            </span>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Total Return</span>
            <strong
              className={`text-sm font-mono ${
                (backtest?.performance?.total_return_pct ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {backtest?.performance
                ? `${backtest.performance.total_return_pct > 0 ? '+' : ''}${backtest.performance.total_return_pct.toFixed(1)}%`
                : '—'}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Net P&L</span>
            <strong className="text-sm font-mono text-ghost-textPrimary">
              {backtest?.performance
                ? `$${backtest.performance.net_pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
                : '—'}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Trades</span>
            <strong className="text-sm font-mono text-ghost-textPrimary">
              {backtest?.performance?.total_trades ?? 0}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Win Rate</span>
            <strong className="text-sm font-mono text-ghost-textPrimary">
              {backtest?.performance ? `${backtest.performance.win_rate.toFixed(1)}%` : '—'}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Profit Factor</span>
            <strong className="text-sm font-mono text-ghost-textPrimary">
              {backtest?.performance?.profit_factor?.toFixed(2) ?? '—'}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Max Drawdown</span>
            <strong className="text-sm font-mono text-rose-400">
              {backtest?.performance ? `-${backtest.performance.max_drawdown.toFixed(1)}%` : '—'}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Sharpe</span>
            <strong className="text-sm font-mono text-ghost-sand">
              {backtest?.performance?.sharpe_ratio?.toFixed(2) ?? '—'}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Sortino</span>
            <strong className="text-sm font-mono text-ghost-sand">
              {backtest?.performance?.sortino_ratio?.toFixed(2) ?? '—'}
            </strong>
          </div>
        </div>

        {/* Equity Curve Visual */}
        <div className="space-y-2 pt-2">
          <span className="text-[11px] font-bold text-ghost-textMuted uppercase tracking-wider block">
            Equity Curve Timeline
          </span>
          {renderEquityCurve()}
        </div>
      </div>

      {/* SECTION 4: LIVE PAPER TRADING MONITOR */}
      <div className="bg-ghost-card border border-ghost-border rounded-2xl p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-ghost-border">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-ghost-sand" />
            <h2 className="text-xs font-bold text-ghost-textPrimary uppercase tracking-wider">
              LIVE PAPER TRADING TELEMETRY
            </h2>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              paperStatus?.is_active
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                : 'bg-ghost-bg text-ghost-textMuted border-ghost-border'
            }`}
          >
            {paperStatus?.is_active ? '● LIVE MONITORING' : 'OFFLINE'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Open Position</span>
            <strong className="text-xs font-mono text-ghost-textPrimary">
              {paperStatus?.open_position
                ? `${paperStatus.open_position.direction} (${paperStatus.open_position.quantity} units)`
                : 'None'}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Realized P&L</span>
            <strong
              className={`text-xs font-mono ${
                (paperStatus?.realized_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              ${paperStatus?.realized_pnl.toFixed(2) ?? '0.00'}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Unrealized P&L</span>
            <strong
              className={`text-xs font-mono ${
                (paperStatus?.unrealized_pnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              ${paperStatus?.unrealized_pnl.toFixed(2) ?? '0.00'}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Paper Trades</span>
            <strong className="text-xs font-mono text-ghost-textPrimary">
              {paperStatus?.total_trades ?? 0}
            </strong>
          </div>

          <div className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/70">
            <span className="text-[10px] text-ghost-textMuted uppercase block">Paper Win Rate</span>
            <strong className="text-xs font-mono text-ghost-textPrimary">
              {paperStatus?.win_rate !== undefined ? `${paperStatus.win_rate.toFixed(0)}%` : '0%'}
            </strong>
          </div>
        </div>

        {/* Paper Trade Logs */}
        {paperStatus?.trades && paperStatus.trades.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-ghost-border/50">
            <span className="text-[11px] font-bold text-ghost-textMuted uppercase">Recent Executions</span>
            <div className="max-h-36 overflow-y-auto space-y-1.5 font-mono text-[11px]">
              {paperStatus.trades.slice(-5).map((t, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-lg bg-ghost-bg border border-ghost-border/40 flex items-center justify-between"
                >
                  <span>
                    {t.direction} {t.quantity} @ ${t.entry_price.toFixed(2)}
                  </span>
                  <span className={t.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    P&L: ${t.pnl.toFixed(2)} ({t.exit_reason || 'FILLED'})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION 5: AI ANALYSIS & ANOMALY DETECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-ghost-card border border-ghost-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-ghost-border">
            <Cpu className="w-4 h-4 text-ghost-sand" />
            <h2 className="text-xs font-bold text-ghost-textPrimary uppercase tracking-wider">
              AI RISK & OVERFITTING ANALYSIS
            </h2>
          </div>

          <div className="space-y-3.5">
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-ghost-sand block">Performance Analysis</span>
              <p className="text-xs text-ghost-textMuted leading-relaxed">
                {verification?.performance_analysis || 'No backtest analyzed yet.'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-ghost-sand block">AI Risk Explainer</span>
              <p className="text-xs text-ghost-textMuted leading-relaxed">
                {verification?.risk_analysis || 'Historical risk profile pending backtest.'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] font-bold text-ghost-sand block">Overfitting & Robustness</span>
              <p className="text-xs text-ghost-textMuted leading-relaxed">
                {verification?.overfitting_analysis || 'Parameter curve-fitting evaluation pending.'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-ghost-card border border-ghost-border rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-ghost-border">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-ghost-textPrimary uppercase tracking-wider">
              ANOMALIES & FAILURE CONDITIONS
            </h2>
          </div>

          <div className="space-y-3">
            {/* Anomalies */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-ghost-textMuted uppercase">
                Detected Anomalies ({verification?.anomalies?.length ?? 0})
              </span>
              {!verification?.anomalies || verification.anomalies.length === 0 ? (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Zero critical anomalies detected across historical executions.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {verification.anomalies.map((a, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>{a.type.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-rose-500/30">
                          {a.severity}
                        </span>
                      </div>
                      <p>{a.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Failure Conditions */}
            <div className="space-y-1.5 pt-2 border-t border-ghost-border/40">
              <span className="text-[11px] font-bold text-ghost-textMuted uppercase">
                Strategy Failure Conditions ({verification?.failure_conditions?.length ?? 0})
              </span>
              {!verification?.failure_conditions || verification.failure_conditions.length === 0 ? (
                <p className="text-xs text-ghost-textMuted">No adverse market conditions flagged.</p>
              ) : (
                <div className="space-y-2">
                  {verification.failure_conditions.map((fc, i) => (
                    <div key={i} className="p-3 rounded-xl bg-ghost-bg border border-ghost-border text-xs space-y-1">
                      <strong className="text-ghost-sand block">{fc.condition}</strong>
                      <p className="text-ghost-textMuted">{fc.observed_performance}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 6: DATA PROVENANCE */}
      <div className="bg-ghost-card border border-ghost-border rounded-2xl p-5 space-y-3 shadow-sm">
        <div className="flex items-center gap-2 pb-2 border-b border-ghost-border">
          <Database className="w-4 h-4 text-ghost-sand" />
          <h2 className="text-xs font-bold text-ghost-textPrimary uppercase tracking-wider">
            DATA PROVENANCE & REPRODUCIBILITY
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
          <div>
            <span className="text-[10px] text-ghost-textMuted uppercase font-sans block">Data Source</span>
            <span className="text-ghost-textPrimary font-semibold">Binance Spot Public REST</span>
          </div>
          <div>
            <span className="text-[10px] text-ghost-textMuted uppercase font-sans block">Backtest Run ID</span>
            <span className="text-ghost-sand font-semibold">{backtest?.backtest_run_id || 'BT-PENDING'}</span>
          </div>
          <div>
            <span className="text-[10px] text-ghost-textMuted uppercase font-sans block">Fee & Slippage Model</span>
            <span className="text-ghost-textPrimary">0.075% fee / 0.050% slippage</span>
          </div>
          <div>
            <span className="text-[10px] text-ghost-textMuted uppercase font-sans block">Canonical Rules Hash</span>
            <span className="text-ghost-textPrimary truncate max-w-[180px] block">
              {strategy.strategy_hash.slice(0, 16)}...
            </span>
          </div>
        </div>
      </div>

      {/* "WHY THIS SCORE?" MODAL */}
      {showScoreModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ghost-card border border-ghost-border rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border">
              <h3 className="text-sm font-bold text-ghost-textPrimary flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-ghost-sand" />
                <span>Transparent Verification Score Breakdown</span>
              </h3>
              <button
                onClick={() => setShowScoreModal(false)}
                className="text-ghost-textMuted hover:text-ghost-textPrimary text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-ghost-textMuted">
                The verification score is mathematically compiled from five objective pillars without arbitrary overrides:
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-ghost-bg border border-ghost-border">
                  <span>Data Completeness (OHLCV coverage &gt; 50 bars)</span>
                  <strong className="text-ghost-sand font-mono">
                    {verification?.score_breakdown?.data_completeness ?? 0} / 20 pts
                  </strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-ghost-bg border border-ghost-border">
                  <span>Sample Size (Trade sample count &gt; 15)</span>
                  <strong className="text-ghost-sand font-mono">
                    {verification?.score_breakdown?.sample_size ?? 0} / 20 pts
                  </strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-ghost-bg border border-ghost-border">
                  <span>Backtest Health (Drawdown &lt; 25%, Sharpe &gt; 1.0)</span>
                  <strong className="text-ghost-sand font-mono">
                    {verification?.score_breakdown?.backtest_coverage ?? 0} / 25 pts
                  </strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-ghost-bg border border-ghost-border">
                  <span>On-Chain Registration Proof</span>
                  <strong className="text-ghost-sand font-mono">
                    {verification?.score_breakdown?.onchain_proof ?? 0} / 15 pts
                  </strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-ghost-bg border border-ghost-border">
                  <span>Anomaly Clearance (Zero critical anomalies)</span>
                  <strong className="text-ghost-sand font-mono">
                    {verification?.score_breakdown?.anomaly_clearance ?? 0} / 20 pts
                  </strong>
                </div>
              </div>

              <div className="pt-2 border-t border-ghost-border flex items-center justify-between font-bold text-sm">
                <span>Total Verification Score:</span>
                <span className="text-ghost-sand font-mono">
                  {verification?.score !== null && verification?.score !== undefined
                    ? `${Math.round(verification.score)} / 100`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
