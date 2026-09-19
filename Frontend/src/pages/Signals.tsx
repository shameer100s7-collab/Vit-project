import React, { useState, useEffect, useCallback } from 'react';
import {
  Compass,
  Upload,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Layers,
  Activity,
  Plus,
  Database,
  RefreshCw,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';
import { AssetSelector } from '../components/common/AssetSelector';
import { signalsApi } from '../api';
import {
  MarketContextResult,
  MarketContextRequest,
  TimeframeScreenshot,
  AggregatedSignalResult,
} from '../types';

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1H', '4H', '1D', '1W'];

export const Signals: React.FC = () => {
  // Step & Form State
  const [asset, setAsset] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1H');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hasVolume, setHasVolume] = useState<boolean>(true);

  // Live Signal State
  const [currentSignal, setCurrentSignal] = useState<AggregatedSignalResult | null>(null);
  const [isSignalLoading, setIsSignalLoading] = useState<boolean>(false);
  const [signalError, setSignalError] = useState<string | null>(null);

  // Multi-timeframe optional secondary screenshot
  const [enableMtf, setEnableMtf] = useState<boolean>(false);
  const [secondaryTimeframe, setSecondaryTimeframe] = useState<string>('4H');
  const [secondaryImagePreview, setSecondaryImagePreview] = useState<string | null>(null);

  // Analysis Result & Loading State
  const [analysisResult, setAnalysisResult] = useState<MarketContextResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('Inspecting screenshot quality...');
  const [error, setError] = useState<string | null>(null);

  const fetchLiveSignal = useCallback(async () => {
    setIsSignalLoading(true);
    setSignalError(null);
    try {
      const res = await signalsApi.getAssetSignal(asset, timeframe.toLowerCase());
      if (res && res.data) {
        setCurrentSignal(res.data);
      }
    } catch (err: any) {
      setSignalError('Analysis cannot currently be completed: Live market telemetry unavailable.');
    } finally {
      setIsSignalLoading(false);
    }
  }, [asset, timeframe]);

  useEffect(() => {
    fetchLiveSignal();
  }, [fetchLiveSignal]);

  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (
    e: React.DragEvent<HTMLDivElement>,
    setter: (val: string | null) => void
  ) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setter(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!imagePreview) {
      setError('Please upload a chart screenshot to analyze.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingStep('Running Screenshot Quality Gate inspection...');

    try {
      const secondaryScreenshots: TimeframeScreenshot[] = [];
      if (enableMtf && secondaryImagePreview) {
        secondaryScreenshots.push({
          timeframe: secondaryTimeframe,
          image_data: secondaryImagePreview,
        });
      }

      const payload: MarketContextRequest = {
        asset,
        timeframe,
        image_data: imagePreview,
        has_volume: hasVolume,
        secondary_screenshots: secondaryScreenshots.length > 0 ? secondaryScreenshots : undefined,
      };

      setTimeout(() => setLoadingStep('Extracting observable Price and Structural geometry...'), 400);
      setTimeout(() => setLoadingStep('Analyzing Volume participation & Location relative to range...'), 900);
      setTimeout(() => setLoadingStep('Synthesizing Market Context & What to Watch conditions...'), 1400);

      const res = await signalsApi.analyzeContext(payload);
      if (res && res.data) {
        setAnalysisResult(res.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not complete market context analysis. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setImagePreview(null);
    setSecondaryImagePreview(null);
    setError(null);
  };

  // Helper for evidence quality styling
  const getQualityBadgeStyle = (q: string) => {
    switch (q) {
      case 'HIGH':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'MODERATE':
        return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
      case 'LIMITED':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'INSUFFICIENT':
      default:
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
  };

  // Helper for market state styling
  const getStateBadgeStyle = (s: string) => {
    switch (s) {
      case 'EXPANDING':
      case 'TRENDING':
        return 'bg-ghost-burgundy/40 text-ghost-sand border-ghost-burgundyLight';
      case 'COMPRESSING':
      case 'CONSOLIDATING':
      case 'RANGING':
        return 'bg-slate-700/40 text-slate-200 border-slate-600/40';
      case 'REJECTING':
      case 'TRANSITIONING':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'MIXED / UNCLEAR':
      default:
        return 'bg-ghost-card text-ghost-textMuted border-ghost-border';
    }
  };

  // Helper for evidence strength styling
  const getEvidenceStrengthClass = (strength?: string) => {
    switch (strength) {
      case 'Strong':
        return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
      case 'Moderate':
        return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
      case 'Weak':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'Insufficient':
      default:
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    }
  };

  const getDirectionBadge = (dir?: string) => {
    switch (dir?.toUpperCase()) {
      case 'BULLISH':
      case 'BUY':
        return {
          label: 'Bullish',
          cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
          icon: TrendingUp,
        };
      case 'BEARISH':
      case 'SELL':
        return {
          label: 'Bearish',
          cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          icon: TrendingDown,
        };
      case 'NEUTRAL':
        return {
          label: 'Neutral',
          cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          icon: Minus,
        };
      case 'NO_CLEAR_SIGNAL':
      case 'NO CLEAR SIGNAL':
      default:
        return {
          label: 'No Clear Signal',
          cls: 'bg-ghost-card text-ghost-textMuted border-ghost-border',
          icon: Compass,
        };
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ghost-border/70 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ghost-textPrimary">SIGNAL</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-lg bg-ghost-card border border-ghost-border text-ghost-sand font-semibold">
              Market Context Engine
            </span>
          </div>
          <p className="text-xs text-ghost-textMuted mt-1">
            "We don't generate trading signals. We generate market context."
          </p>
        </div>

        {/* Quick controls if analysis is active */}
        {analysisResult && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="px-3.5 py-1.5 rounded-lg bg-ghost-card hover:bg-ghost-border border border-ghost-border text-xs font-medium text-ghost-textPrimary transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Analysis</span>
            </button>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* LIVE MARKET SIGNAL & EVIDENCE (Binance Spot)                        */}
      {/* =================================================================== */}
      <div className="p-6 rounded-2xl bg-ghost-card border border-ghost-border shadow-lg space-y-5">
        {/* Market Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-ghost-border/70 pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-ghost-sand uppercase tracking-wider">
              Live Evidence Engine:
            </span>
            <div className="text-xs text-ghost-textMuted">
              Market signals based on current market evidence.
            </div>
          </div>

          <button
            onClick={fetchLiveSignal}
            disabled={isSignalLoading}
            className="px-3.5 py-1.5 rounded-xl bg-ghost-card hover:bg-ghost-border text-xs font-semibold text-ghost-sand border border-ghost-border transition-colors flex items-center gap-2 disabled:opacity-50"
            title="Refresh real Binance Spot market indicators"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-ghost-sand ${isSignalLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Signal</span>
          </button>
        </div>

        {signalError ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{signalError}</span>
            </div>
            <button
              onClick={fetchLiveSignal}
              className="px-3 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold"
            >
              Retry
            </button>
          </div>
        ) : isSignalLoading && !currentSignal ? (
          <div className="py-6 text-center text-xs text-ghost-textMuted flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-ghost-sand" />
            <span>Gathering live market evidence from Binance Spot...</span>
          </div>
        ) : currentSignal ? (
          <div className="space-y-5">
            {/* CURRENT SIGNAL CARD */}
            <div className="p-4 rounded-xl bg-ghost-bg/70 border border-ghost-border space-y-3">
              <div className="text-[11px] font-bold text-ghost-textMuted uppercase tracking-wider">
                CURRENT SIGNAL
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="text-xs text-ghost-textMuted">
                    Asset: <strong className="text-ghost-textPrimary font-semibold">{currentSignal.asset}</strong>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    {(() => {
                      const dir = getDirectionBadge(currentSignal.direction);
                      const Icon = dir.icon;
                      return (
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${dir.cls}`}>
                          <Icon className="w-3.5 h-3.5" />
                          <span>{dir.label}</span>
                        </span>
                      );
                    })()}
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getEvidenceStrengthClass(currentSignal.evidence_strength)}`}>
                      Evidence Strength: <strong>{currentSignal.evidence_strength || 'Moderate'}</strong>
                    </span>
                  </div>
                </div>

                <div className="text-right text-xs text-ghost-textMuted space-y-0.5">
                  <div>
                    Updated: <strong className="text-ghost-sand font-medium">{currentSignal.freshness?.updated_seconds_ago ?? 0} seconds ago</strong>
                  </div>
                  <div className="flex items-center justify-end gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Data: <strong className="text-emerald-400 font-medium">Live</strong></span>
                    <span>•</span>
                    <span>Source: <strong className="text-ghost-textPrimary font-medium">{currentSignal.freshness?.source || 'Binance Spot'}</strong></span>
                  </div>
                </div>
              </div>
            </div>

            {/* WHY? */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-ghost-textMuted uppercase tracking-wider">
                WHY?
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-ghost-bg/50 border border-ghost-border space-y-1">
                  <span className="text-[11px] font-bold text-ghost-sand block">Momentum</span>
                  <p className="text-xs text-ghost-textPrimary leading-relaxed">
                    {currentSignal.evidence_summary?.momentum || 'Momentum telemetry computed from RSI and MACD.'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-ghost-bg/50 border border-ghost-border space-y-1">
                  <span className="text-[11px] font-bold text-ghost-sand block">Trend</span>
                  <p className="text-xs text-ghost-textPrimary leading-relaxed">
                    {currentSignal.evidence_summary?.trend || 'Price trend relative to 20/50 period averages.'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-ghost-bg/50 border border-ghost-border space-y-1">
                  <span className="text-[11px] font-bold text-ghost-sand block">Volume</span>
                  <p className="text-xs text-ghost-textPrimary leading-relaxed">
                    {currentSignal.evidence_summary?.volume || 'Volume volume ratio relative to 20-period average.'}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-ghost-bg/50 border border-ghost-border space-y-1">
                  <span className="text-[11px] font-bold text-ghost-sand block">Volatility</span>
                  <p className="text-xs text-ghost-textPrimary leading-relaxed">
                    {currentSignal.evidence_summary?.volatility || 'ATR volatility regime classification.'}
                  </p>
                </div>
              </div>
            </div>

            {/* WHAT COULD INVALIDATE THIS? */}
            <div className="space-y-2 pt-2 border-t border-ghost-border/40">
              <h3 className="text-xs font-bold text-ghost-textMuted uppercase tracking-wider">
                WHAT COULD INVALIDATE THIS?
              </h3>
              {currentSignal.what_could_invalidate && currentSignal.what_could_invalidate.length > 0 ? (
                <div className="space-y-1.5">
                  {currentSignal.what_could_invalidate.map((crit, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-ghost-textPrimary">
                      <span className="w-1.5 h-1.5 rounded-full bg-ghost-sand mt-1.5 flex-shrink-0" />
                      <span>{crit}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-ghost-textMuted">
                  A decisive break of structural support or sharp volume divergence would invalidate this market stance.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1. QUALITY GATE FAILURE STATE                                       */}
      {/* =================================================================== */}
      {analysisResult && !analysisResult.quality_gate.quality_gate_passed && (
        <div className="p-8 rounded-2xl bg-ghost-card border border-rose-500/30 shadow-xl space-y-6 max-w-2xl mx-auto text-center animate-in fade-in duration-200">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 mb-2">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold tracking-wider text-rose-400 uppercase">
              CHART CLARITY INSUFFICIENT
            </h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              The screenshot does not provide enough visual information for reliable market-context analysis.
            </p>
          </div>

          <div className="text-left bg-ghost-bg/70 p-4 rounded-xl border border-ghost-border/80 space-y-2 max-w-md mx-auto text-xs text-slate-300">
            <span className="font-semibold text-ghost-textMuted uppercase tracking-wider block mb-1">
              Please upload a clearer screenshot containing:
            </span>
            <div className="space-y-1 pl-1">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ghost-sand" />
                <span>Visible candle bodies and wicks</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ghost-sand" />
                <span>Recent price action without obstruction</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ghost-sand" />
                <span>Enough historical candles for structural reference</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ghost-sand" />
                <span>Timeframe clearly defined</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-ghost-sand" />
                <span>Volume pane if available</span>
              </div>
            </div>

            {analysisResult.quality_gate.reasons.length > 0 && (
              <div className="pt-2 mt-2 border-t border-ghost-border/40 text-[11px] text-rose-300/80">
                <strong>Specific inspection flags:</strong> {analysisResult.quality_gate.reasons.join(' • ')}
              </div>
            )}
          </div>

          <div>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl bg-ghost-burgundy hover:bg-ghost-burgundyLight text-ghost-sand font-semibold text-xs transition-colors shadow"
            >
              Upload Clearer Screenshot
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. SUCCESSFUL MARKET CONTEXT ANALYSIS VIEW                          */}
      {/* =================================================================== */}
      {analysisResult && analysisResult.quality_gate.quality_gate_passed && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Market State Header Banner */}
          <div className="p-6 rounded-2xl bg-ghost-card border border-ghost-border shadow-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ghost-border/60 pb-3 text-xs">
              <div className="flex flex-wrap items-center gap-4 text-ghost-textMuted">
                <span>
                  ASSET: <strong className="text-ghost-textPrimary font-semibold">{analysisResult.asset}</strong>
                </span>
                <span>
                  TIMEFRAME: <strong className="text-ghost-textPrimary font-semibold">{analysisResult.timeframe}</strong>
                </span>
                <span className="flex items-center gap-1.5">
                  EVIDENCE QUALITY:
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider border ${getQualityBadgeStyle(
                      analysisResult.evidence_quality
                    )}`}
                  >
                    {analysisResult.evidence_quality}
                  </span>
                </span>
              </div>

              {analysisResult.live_market_comparison && (
                <div className="flex items-center gap-2 text-ghost-textMuted">
                  <Database className="w-3.5 h-3.5 text-ghost-sand" />
                  <span>
                    Live {analysisResult.live_market_comparison.source || 'Binance'}:{' '}
                    <strong className="text-emerald-400">
                      ${analysisResult.live_market_comparison.live_price?.toLocaleString()}
                    </strong>
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold text-ghost-textMuted uppercase tracking-wider block">
                MARKET STATE
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`px-4 py-1.5 rounded-xl font-bold tracking-wider text-base border ${getStateBadgeStyle(
                    analysisResult.market_state.state
                  )}`}
                >
                  {analysisResult.market_state.state}
                </span>
                <span className="text-sm text-slate-200 font-medium">
                  {analysisResult.market_state.summary}
                </span>
              </div>
            </div>
          </div>

          {/* MARKET MAP (7-row Structured Table) */}
          <div className="p-6 rounded-2xl bg-ghost-card border border-ghost-border shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-ghost-border pb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ghost-textMuted flex items-center gap-2">
                <Compass className="w-4 h-4 text-ghost-sand" />
                MARKET MAP
              </h3>
              <span className="text-xs text-ghost-textMuted">7-Dimension Visual Structure</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <tbody>
                  <tr className="border-b border-ghost-border/40 hover:bg-ghost-bg/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-ghost-sand w-32 uppercase tracking-wider align-top">
                      PRICE
                    </td>
                    <td className="py-3 px-3 text-slate-200 leading-relaxed">
                      {analysisResult.market_map.price}
                    </td>
                  </tr>
                  <tr className="border-b border-ghost-border/40 hover:bg-ghost-bg/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-ghost-sand w-32 uppercase tracking-wider align-top">
                      STRUCTURE
                    </td>
                    <td className="py-3 px-3 text-slate-200 leading-relaxed">
                      {analysisResult.market_map.structure}
                    </td>
                  </tr>
                  <tr className="border-b border-ghost-border/40 hover:bg-ghost-bg/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-ghost-sand w-32 uppercase tracking-wider align-top">
                      TIME
                    </td>
                    <td className="py-3 px-3 text-slate-200 leading-relaxed">
                      {analysisResult.market_map.time}
                    </td>
                  </tr>
                  <tr className="border-b border-ghost-border/40 hover:bg-ghost-bg/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-ghost-sand w-32 uppercase tracking-wider align-top">
                      VOLUME
                    </td>
                    <td className="py-3 px-3 text-slate-200 leading-relaxed">
                      {analysisResult.market_map.volume}
                    </td>
                  </tr>
                  <tr className="border-b border-ghost-border/40 hover:bg-ghost-bg/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-ghost-sand w-32 uppercase tracking-wider align-top">
                      RANGE
                    </td>
                    <td className="py-3 px-3 text-slate-200 leading-relaxed">
                      {analysisResult.market_map.range}
                    </td>
                  </tr>
                  <tr className="border-b border-ghost-border/40 hover:bg-ghost-bg/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-ghost-sand w-32 uppercase tracking-wider align-top">
                      LOCATION
                    </td>
                    <td className="py-3 px-3 text-slate-200 leading-relaxed">
                      {analysisResult.market_map.location}
                    </td>
                  </tr>
                  <tr className="hover:bg-ghost-bg/40 transition-colors">
                    <td className="py-3 px-3 font-semibold text-ghost-sand w-32 uppercase tracking-wider align-top">
                      CANDLE
                    </td>
                    <td className="py-3 px-3 text-slate-200 leading-relaxed">
                      {analysisResult.market_map.candle_behavior}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Evidence Grid: Supporting vs Conflicting */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supporting Evidence */}
            <div className="p-5 rounded-2xl bg-ghost-card border border-ghost-border space-y-3">
              <div className="flex items-center gap-2 border-b border-ghost-border/60 pb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  SUPPORTING EVIDENCE
                </h4>
              </div>
              <ul className="space-y-2 text-xs text-slate-200">
                {analysisResult.supporting_evidence.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Conflicting / Limiting Evidence */}
            <div className="p-5 rounded-2xl bg-ghost-card border border-ghost-border space-y-3">
              <div className="flex items-center gap-2 border-b border-ghost-border/60 pb-2">
                <AlertTriangle className="w-4 h-4 text-amber-300" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  CONFLICTING / LIMITING EVIDENCE
                </h4>
              </div>
              <ul className="space-y-2 text-xs text-slate-200">
                {analysisResult.conflicting_evidence.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-amber-300 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CURRENT CONTEXT SYNTHESIS */}
          <div className="p-5 rounded-2xl bg-ghost-card border border-ghost-border space-y-2">
            <span className="text-[11px] font-bold text-ghost-textMuted uppercase tracking-wider block">
              CURRENT CONTEXT
            </span>
            <p className="text-sm text-slate-200 leading-relaxed font-normal bg-ghost-bg p-4 rounded-xl border border-ghost-border/60">
              {analysisResult.current_context}
            </p>
          </div>

          {/* WHAT TO WATCH (Context Change Conditions) */}
          <div className="p-5 rounded-2xl bg-ghost-card border border-ghost-border space-y-3">
            <div className="flex items-center justify-between border-b border-ghost-border/60 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-ghost-sand flex items-center gap-2">
                <Activity className="w-4 h-4 text-ghost-sand" />
                WHAT TO WATCH
              </h4>
              <span className="text-[11px] text-ghost-textMuted">Observable Context Change Triggers</span>
            </div>

            <div className="space-y-2">
              {analysisResult.what_to_watch.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/60 text-xs text-slate-200 flex items-start gap-2"
                >
                  <span className="text-ghost-sand font-bold">•</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* MULTI-TIMEFRAME SYNTHESIS (if present) */}
          {analysisResult.multi_timeframe_synthesis && (
            <div className="p-5 rounded-2xl bg-ghost-card border border-ghost-border space-y-3">
              <div className="flex items-center gap-2 border-b border-ghost-border/60 pb-2">
                <Layers className="w-4 h-4 text-ghost-sand" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                  HIERARCHICAL MULTI-TIMEFRAME SYNTHESIS
                </h4>
              </div>

              {analysisResult.multi_timeframe_levels && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {analysisResult.multi_timeframe_levels.map((lvl, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-ghost-bg border border-ghost-border/60 space-y-1">
                      <span className="font-bold text-ghost-sand block">{lvl.timeframe} ({lvl.context_role.replace(/_/g, ' ')})</span>
                      <p className="text-slate-300">{lvl.structure_summary}</p>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-slate-300 bg-ghost-bg/70 p-3 rounded-xl border border-ghost-border/40">
                {analysisResult.multi_timeframe_synthesis}
              </p>
            </div>
          )}

          {/* DATA LIMITATIONS (Only displayed when limitations actually exist) */}
          {analysisResult.limitations && analysisResult.limitations.length > 0 && (
            <div className="p-4 rounded-xl bg-ghost-bg border border-ghost-border/80 text-xs text-ghost-textMuted space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                <Info className="w-3.5 h-3.5 text-ghost-sand" />
                <span>Data Limitations Disclosed:</span>
              </div>
              <ul className="space-y-1 pl-5 list-disc text-slate-400">
                {analysisResult.limitations.map((lim, idx) => (
                  <li key={idx}>{lim}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-ghost-border/70">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-ghost-card hover:bg-ghost-border border border-ghost-border text-xs font-semibold text-ghost-textMuted hover:text-ghost-textPrimary transition-colors flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Print Context Report</span>
            </button>

            <button
              onClick={handleReset}
              className="px-5 py-2 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold text-xs flex items-center gap-2 hover:bg-ghost-burgundyLight transition-colors shadow"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Upload New Chart</span>
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. STEP-BY-STEP INTAKE WORKFLOW (When no active result)             */}
      {/* =================================================================== */}
      {!analysisResult && (
        <div className="p-6 sm:p-8 rounded-2xl bg-ghost-card border border-ghost-border shadow-xl space-y-6">
          <div className="space-y-1 border-b border-ghost-border/70 pb-4">
            <h2 className="text-base font-semibold text-ghost-textPrimary">Chart Context Intake</h2>
            <p className="text-xs text-ghost-textMuted">
              Upload your chart screenshot. GHOST will inspect visual quality, extract observable market features, and synthesize market context.
            </p>
          </div>

          {/* STEP 1: ASSET & STEP 2: TIMEFRAME */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-semibold text-ghost-textMuted uppercase tracking-wider mb-2">
                STEP 1 — Asset / Pair
              </label>
              <AssetSelector selectedSymbol={asset} onSelectSymbol={setAsset} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-ghost-textMuted uppercase tracking-wider mb-2">
                STEP 2 — Timeframe
              </label>
              <div className="grid grid-cols-8 gap-1 bg-ghost-bg p-1 rounded-lg border border-ghost-border">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                      timeframe === tf
                        ? 'bg-ghost-burgundy text-ghost-sand shadow border border-ghost-burgundyLight font-bold'
                        : 'text-ghost-textMuted hover:text-ghost-textPrimary'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* STEP 3: SCREENSHOT UPLOAD */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ghost-textMuted uppercase tracking-wider">
                STEP 3 — Upload Chart Screenshot
              </label>
              <span className="text-xs text-ghost-textMuted">Clear candles + wicks required</span>
            </div>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, setImagePreview)}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                imagePreview
                  ? 'border-ghost-sand/60 bg-ghost-bg/60'
                  : 'border-ghost-border hover:border-ghost-sand/40 bg-ghost-bg/40'
              }`}
            >
              {imagePreview ? (
                <div className="space-y-4">
                  <div className="max-h-72 overflow-hidden rounded-lg border border-ghost-border inline-block shadow">
                    <img src={imagePreview} alt="Primary Chart Preview" className="max-h-72 object-contain" />
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <label className="text-xs px-3 py-1.5 rounded-lg bg-ghost-card hover:bg-ghost-border border border-ghost-border font-medium text-ghost-textPrimary cursor-pointer transition-colors">
                      Replace Screenshot
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, setImagePreview)}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setImagePreview(null)}
                      className="text-xs px-3 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="inline-flex p-3 rounded-2xl bg-ghost-card border border-ghost-border text-ghost-sand">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-ghost-textPrimary">
                      Drag &amp; drop your chart screenshot, or{' '}
                      <label className="text-ghost-sand hover:underline cursor-pointer">
                        browse file
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, setImagePreview)}
                          className="hidden"
                        />
                      </label>
                    </p>
                    <p className="text-xs text-ghost-textMuted mt-1">
                      Make sure candle bodies, wicks and recent price action are visible. Include volume if available.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Volume indicator toggle */}
            <div className="flex items-center gap-2 pt-1 text-xs text-ghost-textMuted">
              <input
                type="checkbox"
                id="hasVolumeCheck"
                checked={hasVolume}
                onChange={(e) => setHasVolume(e.target.checked)}
                className="rounded border-ghost-border text-ghost-burgundy focus:ring-0"
              />
              <label htmlFor="hasVolumeCheck" className="cursor-pointer">
                Volume pane is visible in this screenshot
              </label>
            </div>
          </div>

          {/* Optional Multi-Timeframe Attachment */}
          <div className="pt-2 border-t border-ghost-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mtfCheck"
                  checked={enableMtf}
                  onChange={(e) => setEnableMtf(e.target.checked)}
                  className="rounded border-ghost-border text-ghost-burgundy focus:ring-0"
                />
                <label htmlFor="mtfCheck" className="text-xs font-semibold text-ghost-textPrimary cursor-pointer">
                  Attach Supplementary Higher-Timeframe Screenshot (Multi-Timeframe Synthesis)
                </label>
              </div>
              <span className="text-[11px] text-ghost-textMuted">Optional</span>
            </div>

            {enableMtf && (
              <div className="p-4 rounded-xl bg-ghost-bg border border-ghost-border space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs text-ghost-textMuted">Secondary Timeframe:</label>
                  <select
                    value={secondaryTimeframe}
                    onChange={(e) => setSecondaryTimeframe(e.target.value)}
                    className="bg-ghost-card border border-ghost-border rounded px-2.5 py-1 text-xs text-ghost-textPrimary focus:outline-none"
                  >
                    {TIMEFRAMES.filter((t) => t !== timeframe).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-ghost-card hover:bg-ghost-border border border-ghost-border text-xs font-medium text-ghost-textPrimary cursor-pointer transition-colors">
                    <Upload className="w-3.5 h-3.5 text-ghost-sand" />
                    <span>Choose Secondary Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, setSecondaryImagePreview)}
                      className="hidden"
                    />
                  </label>
                  {secondaryImagePreview && (
                    <span className="text-xs text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Secondary chart attached ({secondaryTimeframe})
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Analyze Submit Button */}
          <div className="pt-2">
            <button
              onClick={handleAnalyze}
              disabled={isLoading || !imagePreview}
              className="w-full py-3.5 px-6 rounded-xl bg-ghost-burgundy hover:bg-ghost-burgundyLight text-ghost-sand font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-ghost-sand" />
                  <span>{loadingStep}</span>
                </>
              ) : (
                <>
                  <Compass className="w-4 h-4 text-ghost-sand" />
                  <span>Analyze Market Context</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Signals;
