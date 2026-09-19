import React, { useState, useEffect } from 'react';
import {
  Scale,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ArrowRight,
  Database,
  ChevronRight,
  RefreshCw,
  Eye,
  Plus,
  TrendingUp,
  TrendingDown,
  Compass,
  Upload,
  Layers,
} from 'lucide-react';
import { AssetSelector } from '../components/common/AssetSelector';
import { EvidenceModal } from '../components/courtroom/EvidenceModal';
import { courtroomApi } from '../api/courtroom';
import {
  CourtroomCase,
  CourtroomCaseCreate,
  CourtroomArgument,
  VerdictType,
} from '../types';

const TIMEFRAMES = ['5m', '15m', '1h', '4h', '1D', '1W'];

const SAMPLE_THESES = [
  'I think BTC is bullish because momentum is increasing and holding higher lows.',
  'ETH is going to break down below support on fading volume.',
  'I think SOL is entering a strong uptrend breakout.',
  'Current market drop is only a temporary pullback, not a trend reversal.',
  'BTC is entering a choppy sideways consolidation range.',
];

export const Courtroom: React.FC = () => {
  // Navigation & Active State
  const [activeTab, setActiveTab] = useState<'case-file' | 'prosecution' | 'defense' | 'cross-exam' | 'verdict' | 'summary'>('case-file');
  const [selectedArgument, setSelectedArgument] = useState<CourtroomArgument | null>(null);

  // Form State
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [timeframe, setTimeframe] = useState<string>('4h');
  const [thesis, setThesis] = useState<string>('');
  const [userNotes, setUserNotes] = useState<string>('');
  const [supportLevel, setSupportLevel] = useState<string>('');
  const [resistanceLevel, setResistanceLevel] = useState<string>('');
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);

  // Active Case & History
  const [currentCase, setCurrentCase] = useState<CourtroomCase | null>(null);
  const [recentCases, setRecentCases] = useState<CourtroomCase[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('Convening court...');
  const [error, setError] = useState<string | null>(null);

  // Load recent cases on mount
  useEffect(() => {
    loadRecentCases();
  }, []);

  const loadRecentCases = async () => {
    try {
      const res = await courtroomApi.getCases(10);
      if (res && res.data) {
        setRecentCases(res.data);
      }
    } catch (err) {
      // Non-blocking
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshotPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConveneCourt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thesis.trim()) {
      setError('Please state your market thesis before convening court.');
      return;
    }

    setError(null);
    setIsLoading(true);
    setLoadingStep('Gathering market telemetry from Binance Spot...');

    try {
      const payload: CourtroomCaseCreate = {
        symbol,
        timeframe,
        thesis: thesis.trim(),
        user_thesis: thesis.trim(),
        notes: userNotes.trim() || undefined,
        user_notes: userNotes.trim() || undefined,
        support_level: supportLevel ? parseFloat(supportLevel) : undefined,
        resistance_level: resistanceLevel ? parseFloat(resistanceLevel) : undefined,
        screenshot_data: screenshotPreview || undefined,
        chart_screenshot: screenshotPreview || undefined,
      };

      setTimeout(() => setLoadingStep('Analyzing Prosecution counter-arguments...'), 500);
      setTimeout(() => setLoadingStep('Building Defense counsel validation matrix...'), 1000);
      setTimeout(() => setLoadingStep('Formulating verdict and invalidation criteria...'), 1500);

      const res = await courtroomApi.createCase(payload);
      if (res && res.data) {
        setCurrentCase(res.data);
        setActiveTab('case-file');
        loadRecentCases();
      }
    } catch (err: any) {
      setError(err?.message || 'Could not convene Courtroom inquest. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshEvidence = async () => {
    if (!currentCase) return;
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await courtroomApi.refreshCase(currentCase.case_id);
      if (res && res.data) {
        setCurrentCase(res.data);
        loadRecentCases();
      }
    } catch (err: any) {
      setError(err?.message || 'Could not refresh live market telemetry for this case.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleReopenCase = async (caseObj: CourtroomCase) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await courtroomApi.getCase(caseObj.case_id);
      if (res && res.data) {
        setCurrentCase(res.data);
        setActiveTab('case-file');
      }
    } catch (err) {
      setCurrentCase(caseObj);
      setActiveTab('case-file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetNewCase = () => {
    setCurrentCase(null);
    setThesis('');
    setUserNotes('');
    setSupportLevel('');
    setResistanceLevel('');
    setScreenshotPreview(null);
    setError(null);
  };

  // Helper styling for Verdict Badges
  const getVerdictStyle = (verdict: VerdictType) => {
    switch (verdict) {
      case 'SUPPORTED':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'PARTIALLY SUPPORTED':
        return 'bg-ghost-burgundy/40 text-ghost-sand border-ghost-burgundyLight';
      case 'WEAKENED':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'CONTRADICTED':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'INCONCLUSIVE':
      default:
        return 'bg-ghost-card text-ghost-textMuted border-ghost-border';
    }
  };

  // =========================================================================
  // VIEW 1: INTAKE FORM (When no active currentCase)
  // =========================================================================
  if (!currentCase) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 py-2 animate-in fade-in duration-300">
        {/* Top Title Banner */}
        <div className="flex items-center justify-between border-b border-ghost-border/70 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Scale className="w-6 h-6 text-ghost-sand" />
              <h1 className="text-2xl font-bold tracking-tight text-ghost-textPrimary">COURTROOM</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-lg bg-ghost-burgundy text-ghost-sand font-bold border border-ghost-burgundyLight">
                Adversarial Intelligence
              </span>
            </div>
            <p className="text-xs text-ghost-textMuted mt-1">
              Challenge your thinking before you act. Present a market thesis and stress-test it against real market evidence.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleConveneCourt} className="p-6 sm:p-8 rounded-2xl bg-ghost-card border border-ghost-border shadow-xl space-y-6">
          <div className="space-y-1 border-b border-ghost-border/70 pb-4">
            <h2 className="text-base font-bold text-ghost-textPrimary">State Your Market Thesis</h2>
            <p className="text-xs text-ghost-textMuted">
              Provide your hypothesis regarding asset price movement, timeframe, and supporting rationale.
            </p>
          </div>

          {/* Symbol & Timeframe Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-ghost-textMuted uppercase tracking-wider mb-2">
                Target Market Asset
              </label>
              <AssetSelector
                selectedSymbol={symbol.includes('/') ? symbol : `${symbol.slice(0, -4)}/${symbol.slice(-4)}`}
                onSelectSymbol={(s) => setSymbol(s.replace('/', ''))}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ghost-textMuted uppercase tracking-wider mb-2">
                Analysis Timeframe
              </label>
              <div className="grid grid-cols-6 gap-1 bg-ghost-darkest p-1 rounded-xl border border-ghost-border">
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

          {/* Thesis Input Area */}
          <div>
            <label className="block text-xs font-bold text-ghost-textMuted uppercase tracking-wider mb-2">
              Your Market Thesis
            </label>
            <textarea
              value={thesis}
              onChange={(e) => setThesis(e.target.value)}
              placeholder="e.g. I think BTC is bullish because momentum is increasing and price is defending higher lows on the 4H chart..."
              className="w-full h-28 p-3.5 rounded-xl bg-ghost-darkest border border-ghost-border text-xs text-ghost-textPrimary placeholder:text-ghost-textDim focus:outline-none focus:border-ghost-burgundySoft leading-relaxed"
              required
            />

            {/* Quick Inspiration Chips */}
            <div className="mt-2.5">
              <span className="text-xs text-ghost-textMuted block mb-1.5">Or try an example thesis:</span>
              <div className="flex flex-wrap gap-1.5">
                {SAMPLE_THESES.map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setThesis(sample)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-ghost-darkest hover:bg-ghost-border/60 text-ghost-textMuted hover:text-ghost-textPrimary transition-colors text-left border border-ghost-border/40"
                  >
                    "{sample.slice(0, 45)}..."
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Supporting Context */}
          <div className="pt-2 border-t border-ghost-border/60 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ghost-textMuted uppercase tracking-wider">
                Optional Context
              </span>
              <span className="text-xs text-ghost-textMuted">(Optional)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-ghost-textMuted mb-1 font-semibold">Key Support Level ($)</label>
                <input
                  type="number"
                  step="any"
                  value={supportLevel}
                  onChange={(e) => setSupportLevel(e.target.value)}
                  placeholder="e.g. 81000"
                  className="w-full px-3 py-2 rounded-xl bg-ghost-darkest border border-ghost-border text-xs text-ghost-textPrimary focus:outline-none focus:border-ghost-burgundySoft"
                />
              </div>

              <div>
                <label className="block text-xs text-ghost-textMuted mb-1 font-semibold">Key Resistance Level ($)</label>
                <input
                  type="number"
                  step="any"
                  value={resistanceLevel}
                  onChange={(e) => setResistanceLevel(e.target.value)}
                  placeholder="e.g. 85000"
                  className="w-full px-3 py-2 rounded-xl bg-ghost-darkest border border-ghost-border text-xs text-ghost-textPrimary focus:outline-none focus:border-ghost-burgundySoft"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-ghost-textMuted mb-1 font-semibold">Additional Notes</label>
              <input
                type="text"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                placeholder="e.g. Looking at recent 4H candle volume rejection and moving average touch"
                className="w-full px-3 py-2 rounded-xl bg-ghost-darkest border border-ghost-border text-xs text-ghost-textPrimary focus:outline-none focus:border-ghost-burgundySoft"
              />
            </div>

            {/* Optional Screenshot Upload */}
            <div>
              <label className="block text-xs text-ghost-textMuted mb-1 font-semibold">Attach Chart Screenshot</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-ghost-darkest hover:bg-ghost-border/60 border border-ghost-border text-xs font-medium text-ghost-textPrimary cursor-pointer transition-colors">
                  <Upload className="w-4 h-4 text-ghost-sand" />
                  <span>Choose Image</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
                {screenshotPreview && (
                  <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Screenshot attached
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-6 rounded-xl bg-ghost-burgundy hover:bg-ghost-burgundyLight text-ghost-sand font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-ghost-sand" />
                  <span>{loadingStep}</span>
                </>
              ) : (
                <>
                  <Scale className="w-4 h-4 text-ghost-sand" />
                  <span>Open Court</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Recent Cases Section */}
        {recentCases.length > 0 && (
          <div className="p-6 rounded-2xl bg-ghost-card border border-ghost-border shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold text-ghost-textMuted uppercase tracking-wider">
                Recent Courtroom Cases
              </h3>
              <span className="text-xs text-ghost-textMuted">{recentCases.length} cases recorded</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recentCases.map((c) => (
                <div
                  key={c.case_id}
                  onClick={() => handleReopenCase(c)}
                  className="p-3.5 rounded-xl bg-ghost-darkest/60 hover:bg-ghost-border/40 border border-ghost-border cursor-pointer transition-colors flex items-center justify-between group"
                >
                  <div className="space-y-1 pr-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-ghost-sand">{c.case_id}</span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-ghost-card text-ghost-textMuted font-medium">
                        {c.symbol} • {c.timeframe}
                      </span>
                    </div>
                    <p className="text-xs text-ghost-textPrimary font-medium line-clamp-1">"{c.user_thesis}"</p>
                    <div className="text-[11px] text-ghost-textMuted">
                      Verdict: <span className="font-semibold text-ghost-sand">{c.verdict}</span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-ghost-textMuted group-hover:text-ghost-sand transition-colors flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: ACTIVE COURTROOM SESSION (When currentCase is populated)
  // =========================================================================
  const isBullish = currentCase.detected_stance === 'BULLISH';
  const isBearish = currentCase.detected_stance === 'BEARISH';
  const snapshot = currentCase.market_snapshot || {};

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-2 animate-in fade-in duration-200">
      {/* Active Case Top Header */}
      <div className="p-5 rounded-2xl bg-ghost-card border border-ghost-border shadow-lg space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-bold text-ghost-sand tracking-wider">
              {currentCase.case_id}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {currentCase.status}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-lg bg-ghost-darkest border border-ghost-border text-ghost-textPrimary font-semibold">
              {currentCase.symbol} • {currentCase.timeframe}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-lg font-bold flex items-center gap-1 ${
                isBullish
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : isBearish
                  ? 'bg-rose-500/15 text-rose-300'
                  : 'bg-ghost-burgundy/40 text-ghost-sand'
              }`}
            >
              {isBullish && <TrendingUp className="w-3 h-3" />}
              {isBearish && <TrendingDown className="w-3 h-3" />}
              {currentCase.detected_stance} THESIS
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshEvidence}
              disabled={isRefreshing}
              className="px-3.5 py-1.5 rounded-xl bg-ghost-card hover:bg-ghost-border text-xs font-semibold text-ghost-sand border border-ghost-border transition-colors flex items-center gap-1.5 disabled:opacity-50"
              title="Refresh live Binance Spot telemetry and re-evaluate courtroom arguments"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-ghost-sand ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh Evidence'}</span>
            </button>
            <button
              onClick={handleResetNewCase}
              className="px-3.5 py-1.5 rounded-xl bg-ghost-card hover:bg-ghost-border text-xs font-semibold text-ghost-textMuted hover:text-ghost-textPrimary border border-ghost-border transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Thesis</span>
            </button>
          </div>
        </div>

        {/* User Thesis Callout */}
        <div className="p-4 rounded-xl bg-ghost-darkest border border-ghost-border flex items-start gap-3">
          <Scale className="w-5 h-5 text-ghost-sand flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="text-[11px] font-bold text-ghost-textMuted uppercase tracking-wider block mb-0.5">
              User Thesis Under Cross-Examination
            </span>
            <p className="text-sm font-medium text-ghost-textPrimary">"{currentCase.user_thesis}"</p>
          </div>
        </div>

        {/* Live Telemetry Sub-bar */}
        <div className="flex flex-wrap items-center justify-between pt-2 border-t border-ghost-border/40 text-xs text-ghost-textMuted gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              Price: <strong className="text-ghost-sand font-bold">${snapshot.price ? snapshot.price.toLocaleString() : 'N/A'}</strong>
            </span>
            <span>
              24h High: <strong className="text-slate-300">${snapshot.high_24h ? snapshot.high_24h.toLocaleString() : 'N/A'}</strong>
            </span>
            <span>
              24h Low: <strong className="text-slate-300">${snapshot.low_24h ? snapshot.low_24h.toLocaleString() : 'N/A'}</strong>
            </span>
            <span>
              RSI(14): <strong className="text-ghost-sand font-bold">{snapshot.rsi_14 ?? 'N/A'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-ghost-sand" />
              Source: <strong className="text-slate-200">{snapshot.source || 'Binance Spot'}</strong>
            </span>
            <span className="text-emerald-400 font-semibold">● Live</span>
          </div>
        </div>
      </div>

      {/* Interactive Phase Stepper / Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 p-1 bg-ghost-card rounded-2xl border border-ghost-border text-xs">
        <button
          onClick={() => setActiveTab('case-file')}
          className={`flex-1 min-w-[120px] py-2.5 px-3 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'case-file'
              ? 'bg-ghost-burgundy text-ghost-sand shadow border border-ghost-burgundyLight font-bold'
              : 'text-ghost-textMuted hover:text-ghost-textPrimary'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>1. Case File</span>
        </button>

        <button
          onClick={() => setActiveTab('prosecution')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'prosecution'
              ? 'bg-ghost-burgundy text-rose-300 shadow border border-rose-500/40 font-bold'
              : 'text-ghost-textMuted hover:text-ghost-textPrimary'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
          <span>2. Prosecution ({currentCase.prosecution_arguments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('defense')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'defense'
              ? 'bg-ghost-burgundy text-ghost-sand shadow border border-ghost-burgundyLight font-bold'
              : 'text-ghost-textMuted hover:text-ghost-textPrimary'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>3. Defense ({currentCase.defense_arguments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cross-exam')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'cross-exam'
              ? 'bg-ghost-burgundy text-amber-300 shadow border border-amber-500/40 font-bold'
              : 'text-ghost-textMuted hover:text-ghost-textPrimary'
          }`}
        >
          <Scale className="w-3.5 h-3.5 text-amber-300" />
          <span>4. Cross-Exam</span>
        </button>

        <button
          onClick={() => setActiveTab('verdict')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'verdict'
              ? 'bg-ghost-burgundy text-ghost-sand shadow border border-ghost-burgundyLight font-bold'
              : 'text-ghost-textMuted hover:text-ghost-textPrimary'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-ghost-sand" />
          <span>5. Verdict &amp; Rules</span>
        </button>

        <button
          onClick={() => setActiveTab('summary')}
          className={`flex-1 min-w-[110px] py-2.5 px-3 rounded-xl font-medium flex items-center justify-center gap-1.5 transition-colors ${
            activeTab === 'summary'
              ? 'bg-ghost-burgundy text-ghost-sand shadow border border-ghost-burgundyLight font-bold'
              : 'text-ghost-textMuted hover:text-ghost-textPrimary'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>6. Summary</span>
        </button>
      </div>

      {/* PHASE 1: CASE FILE */}
      {activeTab === 'case-file' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="p-6 rounded-2xl bg-ghost-card border border-ghost-border space-y-5">
            <div className="flex items-center justify-between border-b border-ghost-border pb-3">
              <h3 className="text-base font-bold text-ghost-textPrimary flex items-center gap-2">
                <FileText className="w-5 h-5 text-ghost-sand" />
                Case File Dossier
              </h3>
              <span className="text-xs text-ghost-textMuted">
                {currentCase.evidence_count} telemetry metrics evaluated
              </span>
            </div>

            {/* Core Snapshot Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 rounded-xl bg-ghost-darkest border border-ghost-border">
                <span className="text-xs text-ghost-textMuted block mb-1">Evaluated Stance</span>
                <span className="text-sm font-bold text-ghost-textPrimary">{currentCase.detected_stance}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-ghost-darkest border border-ghost-border">
                <span className="text-xs text-ghost-textMuted block mb-1">Timeframe Horizon</span>
                <span className="text-sm font-bold text-ghost-textPrimary">{currentCase.timeframe}</span>
              </div>
              <div className="p-3.5 rounded-xl bg-ghost-darkest border border-ghost-border">
                <span className="text-xs text-ghost-textMuted block mb-1">Orderbook Imbalance</span>
                <span className="text-sm font-bold text-ghost-textPrimary">
                  {snapshot.orderbook_imbalance !== undefined ? snapshot.orderbook_imbalance.toFixed(4) : 'N/A'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl bg-ghost-darkest border border-ghost-border">
                <span className="text-xs text-ghost-textMuted block mb-1">MACD Histogram</span>
                <span className="text-sm font-bold text-ghost-textPrimary">
                  {snapshot.macd_hist !== undefined ? snapshot.macd_hist.toFixed(4) : 'N/A'}
                </span>
              </div>
            </div>

            {/* User Notes or Screenshot if present */}
            {currentCase.user_notes && (
              <div className="p-4 rounded-xl bg-ghost-darkest border border-ghost-border space-y-1">
                <span className="text-xs font-bold text-ghost-textMuted uppercase tracking-wider">
                  User Context &amp; Notes
                </span>
                <p className="text-sm text-slate-300">{currentCase.user_notes}</p>
              </div>
            )}

            {screenshotPreview && (
              <div className="p-4 rounded-xl bg-ghost-darkest border border-ghost-border space-y-2">
                <span className="text-xs font-bold text-ghost-textMuted uppercase tracking-wider block">
                  Attached User Chart Screenshot
                </span>
                <div className="max-h-80 overflow-hidden rounded-xl border border-ghost-border">
                  <img src={screenshotPreview} alt="User Chart" className="w-full object-contain" />
                </div>
              </div>
            )}

            {/* Progression trigger */}
            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setActiveTab('prosecution')}
                className="px-5 py-2.5 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold text-xs flex items-center gap-2 hover:bg-ghost-burgundyLight transition-colors shadow"
              >
                <span>Proceed to Prosecution</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 2: PROSECUTION */}
      {activeTab === 'prosecution' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-300 uppercase tracking-wider">
                Prosecution: The Case Against Your Thesis
              </h4>
              <p className="text-xs text-rose-200/90 mt-0.5">
                The prosecutor's role is to attack assumptions and identify all conflicting market evidence.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {currentCase.prosecution_arguments.map((arg, idx) => (
              <div
                key={arg.id || idx}
                className="p-5 rounded-2xl bg-ghost-card border border-ghost-border hover:border-ghost-border/80 transition-all space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-400">
                        ARGUMENT #{idx + 1}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-ghost-darkest border border-ghost-border text-slate-300">
                        {arg.strength} Evidence
                      </span>
                      <span className="text-xs text-ghost-textMuted">• {arg.updated_ago}</span>
                    </div>
                    <h3 className="text-base font-bold text-ghost-textPrimary">{arg.claim}</h3>
                  </div>

                  <button
                    onClick={() => setSelectedArgument(arg)}
                    className="px-3.5 py-1.5 rounded-xl bg-ghost-darkest hover:bg-ghost-border/60 text-xs font-semibold text-ghost-sand border border-ghost-border transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Evidence ({arg.evidence_items.length})</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-ghost-darkest border border-ghost-border/60 text-sm text-slate-200">
                  <strong className="text-ghost-textMuted block text-xs uppercase mb-1">Observation:</strong>
                  {arg.observation}
                </div>

                <div className="text-xs text-ghost-textMuted">
                  <strong className="text-slate-300">Impact on Thesis: </strong>
                  {arg.why_it_matters}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab('case-file')}
              className="px-4 py-2 rounded-xl bg-ghost-card border border-ghost-border text-xs font-semibold text-ghost-textMuted hover:text-ghost-textPrimary transition-colors"
            >
              Back to Case File
            </button>
            <button
              onClick={() => setActiveTab('defense')}
              className="px-5 py-2.5 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold text-xs flex items-center gap-2 hover:bg-ghost-burgundyLight transition-colors shadow"
            >
              <span>Proceed to Defense Counsel</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PHASE 3: DEFENSE */}
      {activeTab === 'defense' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-emerald-300 uppercase tracking-wider">
                Defense: The Case For Your Thesis
              </h4>
              <p className="text-xs text-emerald-200/90 mt-0.5">
                Defense counsel builds the strongest evidence-based argument supporting your thesis.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {currentCase.defense_arguments.map((arg, idx) => (
              <div
                key={arg.id || idx}
                className="p-5 rounded-2xl bg-ghost-card border border-ghost-border hover:border-ghost-border/80 transition-all space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400">
                        ARGUMENT #{idx + 1}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-ghost-darkest border border-ghost-border text-slate-300">
                        {arg.strength} Evidence
                      </span>
                      <span className="text-xs text-ghost-textMuted">• {arg.updated_ago}</span>
                    </div>
                    <h3 className="text-base font-bold text-ghost-textPrimary">{arg.claim}</h3>
                  </div>

                  <button
                    onClick={() => setSelectedArgument(arg)}
                    className="px-3.5 py-1.5 rounded-xl bg-ghost-darkest hover:bg-ghost-border/60 text-xs font-semibold text-ghost-sand border border-ghost-border transition-colors flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Evidence ({arg.evidence_items.length})</span>
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-ghost-darkest border border-ghost-border/60 text-sm text-slate-200">
                  <strong className="text-ghost-textMuted block text-xs uppercase mb-1">Observation:</strong>
                  {arg.observation}
                </div>

                <div className="text-xs text-ghost-textMuted">
                  <strong className="text-slate-300">Why it Defends the Thesis: </strong>
                  {arg.why_it_matters}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab('prosecution')}
              className="px-4 py-2 rounded-xl bg-ghost-card border border-ghost-border text-xs font-semibold text-ghost-textMuted hover:text-ghost-textPrimary transition-colors"
            >
              Back to Prosecution
            </button>
            <button
              onClick={() => setActiveTab('cross-exam')}
              className="px-5 py-2.5 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold text-xs flex items-center gap-2 hover:bg-ghost-burgundyLight transition-colors shadow"
            >
              <span>Begin Cross-Examination</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PHASE 4: CROSS-EXAMINATION */}
      {activeTab === 'cross-exam' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
            <Scale className="w-5 h-5 text-amber-300 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-200 uppercase tracking-wider">
                Cross-Examination: Evidence Conflict Matrix
              </h4>
              <p className="text-xs text-amber-100/90 mt-0.5">
                Exposing contradictions between supporting and opposing evidence across primary market dimensions.
              </p>
            </div>
          </div>

          {/* Comparison Matrix Table */}
          <div className="rounded-2xl bg-ghost-card border border-ghost-border overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-ghost-border bg-ghost-darkest/70 text-ghost-textMuted uppercase font-semibold">
                    <th className="py-3.5 px-4 w-1/5">Dimension</th>
                    <th className="py-3.5 px-4 w-1/3 text-emerald-400">Evidence FOR Thesis</th>
                    <th className="py-3.5 px-4 w-1/3 text-rose-400">Evidence AGAINST Thesis</th>
                    <th className="py-3.5 px-4 text-center">Conflict Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ghost-border/60">
                  {currentCase.cross_examination.map((row, idx) => (
                    <tr key={idx} className="hover:bg-ghost-darkest/40 transition-colors">
                      <td className="py-4 px-4 font-bold text-ghost-textPrimary align-top">
                        {row.dimension}
                      </td>
                      <td className="py-4 px-4 text-slate-200 align-top leading-relaxed">
                        {row.supporting_evidence}
                      </td>
                      <td className="py-4 px-4 text-slate-200 align-top leading-relaxed">
                        {row.opposing_evidence}
                      </td>
                      <td className="py-4 px-4 align-top text-center">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-md font-bold text-[11px] ${
                            row.severity === 'HIGH'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : row.severity === 'MODERATE'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {row.severity}
                        </span>
                        <span className="block text-[11px] text-ghost-textMuted mt-1 max-w-[160px] mx-auto">
                          {row.conflict_assessment}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab('defense')}
              className="px-4 py-2 rounded-xl bg-ghost-card border border-ghost-border text-xs font-semibold text-ghost-textMuted hover:text-ghost-textPrimary transition-colors"
            >
              Back to Defense
            </button>
            <button
              onClick={() => setActiveTab('verdict')}
              className="px-5 py-2.5 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold text-xs flex items-center gap-2 hover:bg-ghost-burgundyLight transition-colors shadow"
            >
              <span>Deliver Courtroom Verdict</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PHASE 5: VERDICT & INVALIDATION */}
      {activeTab === 'verdict' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Verdict Banner */}
          <div className="p-6 rounded-2xl bg-ghost-card border border-ghost-border space-y-4 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-ghost-textMuted uppercase tracking-wider">
                Official Courtroom Assessment
              </span>
              <span className="text-xs text-ghost-textMuted">Not a buy/sell trade recommendation</span>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div
                className={`px-5 py-2.5 rounded-2xl border text-lg font-extrabold tracking-wider ${getVerdictStyle(
                  currentCase.verdict
                )}`}
              >
                {currentCase.verdict}
              </div>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed bg-ghost-darkest p-4 rounded-xl border border-ghost-border/70">
              {currentCase.verdict_rationale}
            </p>
          </div>

          {/* What Would Invalidate This Thesis? */}
          <div className="p-6 rounded-2xl bg-ghost-card border border-ghost-border space-y-4 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ghost-textPrimary flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-300" />
                  What Would Invalidate This Thesis?
                </h3>
                <p className="text-xs text-ghost-textMuted mt-0.5">
                  Explicit market conditions that would break the underlying premise (thesis invalidation criteria, not trade targets).
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {currentCase.invalidation_conditions.map((cond, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-xl bg-ghost-darkest border border-ghost-border/80 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                      Invalidation Criterion #{idx + 1}
                    </span>
                    {cond.price_reference && (
                      <span className="text-xs text-ghost-sand font-bold">
                        Reference Level: ${cond.price_reference.toLocaleString()}
                      </span>
                    )}
                  </div>

                  <p className="text-sm font-semibold text-ghost-textPrimary">{cond.description}</p>
                  <p className="text-xs text-ghost-textMuted">
                    <strong className="text-slate-300">Rationale: </strong>
                    {cond.rationale}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              onClick={() => setActiveTab('cross-exam')}
              className="px-4 py-2 rounded-xl bg-ghost-card border border-ghost-border text-xs font-semibold text-ghost-textMuted hover:text-ghost-textPrimary transition-colors"
            >
              Back to Cross-Exam
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className="px-5 py-2.5 rounded-xl bg-ghost-burgundy text-ghost-sand font-semibold text-xs flex items-center gap-2 hover:bg-ghost-burgundyLight transition-colors shadow"
            >
              <span>View Case Summary</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* PHASE 6: SUMMARY REPORT */}
      {activeTab === 'summary' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="p-6 rounded-2xl bg-ghost-card border border-ghost-border space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-ghost-border pb-4">
              <div>
                <span className="text-xs font-bold text-ghost-sand block">
                  CASE DOSSIER #{currentCase.case_id}
                </span>
                <h2 className="text-lg font-extrabold text-ghost-textPrimary mt-0.5">
                  Courtroom Inquest Final Summary
                </h2>
              </div>
              <div
                className={`px-3 py-1 rounded-xl border text-xs font-bold tracking-wider ${getVerdictStyle(
                  currentCase.verdict
                )}`}
              >
                {currentCase.verdict}
              </div>
            </div>

            {/* Quick Review Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4" /> Strongest Opposing Evidence
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {currentCase.prosecution_arguments[0]?.observation || 'No critical opposing factors detected.'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Strongest Supporting Evidence
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {currentCase.defense_arguments[0]?.observation || 'No strong baseline support verified.'}
                </p>
              </div>
            </div>

            {/* Invalidation Rules Highlight */}
            <div className="p-4 rounded-xl bg-ghost-darkest border border-ghost-border space-y-2">
              <span className="text-xs font-bold text-ghost-textMuted uppercase tracking-wider block">
                Primary Invalidation Trigger
              </span>
              <p className="text-sm font-semibold text-ghost-textPrimary">
                {currentCase.invalidation_conditions[0]?.description || 'Conditions specified in verdict section.'}
              </p>
            </div>

            {/* Verification Metadata */}
            <div className="p-4 rounded-xl bg-ghost-darkest/60 border border-ghost-border/40 text-xs text-ghost-textMuted space-y-1.5">
              <div className="flex justify-between">
                <span>Inquest Convened:</span>
                <span className="text-slate-300 font-semibold">{new Date(currentCase.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Data Sources:</span>
                <span className="text-slate-300 font-semibold">{currentCase.data_sources.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span>Evidence Items Verified:</span>
                <span className="text-ghost-sand font-bold">{currentCase.evidence_count} items</span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-ghost-border">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl bg-ghost-card hover:bg-ghost-border border border-ghost-border text-xs font-semibold text-ghost-textMuted hover:text-ghost-textPrimary transition-colors flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Print Case Report</span>
              </button>

              <button
                onClick={handleResetNewCase}
                className="px-5 py-2.5 rounded-xl bg-ghost-burgundy text-ghost-sand font-bold text-xs flex items-center gap-2 hover:bg-ghost-burgundyLight transition-colors shadow"
              >
                <Plus className="w-4 h-4" />
                <span>Challenge Another Thesis</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Granular Evidence Telemetry Modal */}
      {selectedArgument && (
        <EvidenceModal
          argument={selectedArgument}
          onClose={() => setSelectedArgument(null)}
        />
      )}
    </div>
  );
};

export default Courtroom;
