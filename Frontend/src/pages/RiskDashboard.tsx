import React, { useEffect, useState, useCallback } from 'react';
import { riskApi } from '../api';
import { AssetRiskResult } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { ShieldAlert, RefreshCw, AlertTriangle, ShieldCheck, Target, TrendingDown, Scale } from 'lucide-react';

export const RiskDashboard: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const benchmark = 'BTC/USDT';
  const [risk, setRisk] = useState<AssetRiskResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);

  const fetchRisk = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await riskApi.getAssetRisk(selectedSymbol, timeframe, 100, benchmark);
      setRisk(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSymbol, timeframe, benchmark]);

  useEffect(() => {
    fetchRisk();
  }, [fetchRisk]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ghost-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-ghost-textPrimary uppercase">
              Quantitative Risk Engine
            </h1>
            <span className="px-2 py-0.5 rounded text-2xs font-mono bg-rose-500/10 text-rose-400 border border-rose-500/30">
              PHASE 10 ENGINE
            </span>
          </div>
          <p className="text-xs font-mono text-ghost-textMuted mt-0.5">
            Parametric & Historical VaR, Expected Shortfall (CVaR), Drawdown dynamics, Sharpe/Sortino ratios, and position sizing
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
            onClick={fetchRisk}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-borderLight text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Re-evaluate</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchRisk} />}

      {isLoading ? (
        <LoadingState message="Simulating Value at Risk, drawdown curves, and downside deviation..." />
      ) : risk ? (
        <div className="space-y-6">
          {/* Executive Risk Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="OVERALL RISK LEVEL"
              value={risk.risk_level}
              badge={<RiskBadge label={risk.risk_level} variant="risk" size="sm" />}
              icon={<ShieldAlert className="w-4 h-4" />}
              variant={risk.risk_level === 'CRITICAL' ? 'red' : risk.risk_level === 'HIGH' ? 'amber' : 'green'}
            />
            <MetricCard
              label="COMPOSITE RISK INDEX"
              value={`${(risk.overall_risk_score * 100).toFixed(1)} / 100`}
              subValue="Enforces bounds: [0.05, 0.95]"
              variant="cyan"
            />
            <MetricCard
              label="1-DAY 95% VaR"
              value={`${(risk.var_metrics.var_95_daily * 100).toFixed(2)}%`}
              subValue={`99% VaR: ${(risk.var_metrics.var_99_daily * 100).toFixed(2)}%`}
              variant="default"
            />
            <MetricCard
              label="MAX HISTORICAL DRAWDOWN"
              value={`${(risk.drawdown_metrics.max_drawdown * 100).toFixed(2)}%`}
              subValue={`Current DD: ${(risk.drawdown_metrics.current_drawdown * 100).toFixed(2)}%`}
              icon={<TrendingDown className="w-4 h-4" />}
              variant="red"
            />
          </div>

          {/* Risk Warnings Banner if any */}
          {risk.risk_warnings.length > 0 && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 font-mono text-xs flex items-start gap-3 shadow-lg">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <div>
                <span className="font-bold uppercase tracking-wider block mb-1">
                  Active Risk Threshold Warnings ({risk.risk_warnings.length})
                </span>
                <ul className="list-disc list-inside space-y-1 text-2xs text-rose-200/90">
                  {risk.risk_warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Section 1: Value at Risk (VaR) & Expected Shortfall (CVaR) Dual Model */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-ghost-border/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-ghost-cyan" />
                <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                  Value at Risk (VaR) & Expected Shortfall (CVaR) Matrix
                </h3>
              </div>
              <span className="text-2xs font-mono text-ghost-textMuted">
                Method: {risk.var_metrics.method}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono text-xs">
              {/* Box 1: 95% Daily VaR Comparison */}
              <div className="p-4 rounded-xl bg-ghost-darkest border border-ghost-border/60">
                <span className="text-2xs font-semibold text-ghost-textMuted uppercase tracking-wider block mb-1">
                  95% VaR (1-Day Horizon)
                </span>
                <div className="text-2xl font-bold text-ghost-textPrimary mb-3">
                  {(risk.var_metrics.var_95_daily * 100).toFixed(2)}%
                </div>
                <div className="space-y-1 text-2xs text-ghost-textMuted border-t border-ghost-border/40 pt-2">
                  <div className="flex justify-between">
                    <span>Parametric (Gaussian):</span>
                    <strong className="text-ghost-textPrimary">{(risk.var_metrics.parametric_var_95 * 100).toFixed(2)}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Historical Simulation:</span>
                    <strong className="text-ghost-textPrimary">{(risk.var_metrics.historical_var_95 * 100).toFixed(2)}%</strong>
                  </div>
                </div>
              </div>

              {/* Box 2: 95% Daily CVaR (Expected Shortfall) */}
              <div className="p-4 rounded-xl bg-ghost-darkest border border-ghost-border/60">
                <span className="text-2xs font-semibold text-ghost-textMuted uppercase tracking-wider block mb-1">
                  95% CVaR (Expected Shortfall)
                </span>
                <div className="text-2xl font-bold text-ghost-amber mb-3">
                  {(risk.var_metrics.cvar_95_daily * 100).toFixed(2)}%
                </div>
                <div className="space-y-1 text-2xs text-ghost-textMuted border-t border-ghost-border/40 pt-2">
                  <div className="flex justify-between">
                    <span>Parametric Tail:</span>
                    <strong className="text-ghost-textPrimary">{(risk.var_metrics.parametric_cvar_95 * 100).toFixed(2)}%</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Historical Tail Mean:</span>
                    <strong className="text-ghost-textPrimary">{(risk.var_metrics.historical_cvar_95 * 100).toFixed(2)}%</strong>
                  </div>
                </div>
              </div>

              {/* Box 3: 99% Daily VaR */}
              <div className="p-4 rounded-xl bg-ghost-darkest border border-ghost-border/60">
                <span className="text-2xs font-semibold text-ghost-textMuted uppercase tracking-wider block mb-1">
                  99% VaR (Extreme Quantile)
                </span>
                <div className="text-2xl font-bold text-ghost-red mb-3">
                  {(risk.var_metrics.var_99_daily * 100).toFixed(2)}%
                </div>
                <div className="space-y-1 text-2xs text-ghost-textMuted border-t border-ghost-border/40 pt-2">
                  <div className="flex justify-between">
                    <span>Loss Probability:</span>
                    <strong className="text-ghost-textPrimary">1.0% (1 in 100 days)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence Level:</span>
                    <strong className="text-ghost-textPrimary">α = 0.99</strong>
                  </div>
                </div>
              </div>

              {/* Box 4: 99% Daily CVaR */}
              <div className="p-4 rounded-xl bg-ghost-darkest border border-ghost-border/60">
                <span className="text-2xs font-semibold text-ghost-textMuted uppercase tracking-wider block mb-1">
                  99% CVaR (Extreme Tail)
                </span>
                <div className="text-2xl font-bold text-ghost-red mb-3">
                  {(risk.var_metrics.cvar_99_daily * 100).toFixed(2)}%
                </div>
                <div className="space-y-1 text-2xs text-ghost-textMuted border-t border-ghost-border/40 pt-2">
                  <div className="flex justify-between">
                    <span>Tail Expectation:</span>
                    <strong className="text-ghost-red">E[L | L ≥ VaR99]</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Fat-Tail Cushion:</span>
                    <strong className="text-ghost-textPrimary">{((risk.var_metrics.cvar_99_daily - risk.var_metrics.var_99_daily) * 100).toFixed(2)}%</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Performance, Drawdown, and Market Sensitivity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Risk-Adjusted Return Metrics */}
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-ghost-border/60">
                  <div className="flex items-center gap-2">
                    <Scale className="w-4 h-4 text-ghost-cyan" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                      Risk-Adjusted Efficiency
                    </h3>
                  </div>
                  <span className="text-2xs font-mono text-ghost-textMuted">ANNUALIZED</span>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Sharpe Ratio:</span>
                    <span className={`font-bold ${risk.risk_adjusted_metrics.sharpe_ratio >= 1.0 ? 'text-ghost-green' : 'text-ghost-amber'}`}>
                      {risk.risk_adjusted_metrics.sharpe_ratio.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Sortino Ratio:</span>
                    <span className={`font-bold ${risk.risk_adjusted_metrics.sortino_ratio >= 1.5 ? 'text-ghost-green' : 'text-ghost-amber'}`}>
                      {risk.risk_adjusted_metrics.sortino_ratio.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Calmar Ratio:</span>
                    <span className="font-bold text-ghost-textPrimary">{risk.risk_adjusted_metrics.calmar_ratio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Annualized Volatility:</span>
                    <span className="text-ghost-textPrimary">{(risk.risk_adjusted_metrics.annualized_volatility * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Downside Semi-Deviation:</span>
                    <span className="text-ghost-textPrimary">{(risk.risk_adjusted_metrics.downside_deviation * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Risk-Free Rate (Rf):</span>
                    <span className="text-ghost-textMuted">{(risk.risk_adjusted_metrics.risk_free_rate * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 2: Peak-to-Trough Drawdown Dynamics */}
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-ghost-border/60">
                  <div className="flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-ghost-red" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                      Drawdown Dynamics
                    </h3>
                  </div>
                  <span className="text-2xs font-mono text-ghost-textMuted">CAPITAL PRESERVATION</span>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Max Historical Drawdown:</span>
                    <span className="text-ghost-red font-bold">{(risk.drawdown_metrics.max_drawdown * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Current Drawdown:</span>
                    <span className="text-ghost-amber font-bold">{(risk.drawdown_metrics.current_drawdown * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Periods in Drawdown:</span>
                    <span className="text-ghost-textPrimary">{risk.drawdown_metrics.drawdown_duration_periods} periods</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Observed Peak Price:</span>
                    <span className="text-ghost-green font-bold">${risk.drawdown_metrics.peak_price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Observed Trough Price:</span>
                    <span className="text-ghost-red font-bold">${risk.drawdown_metrics.trough_price.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Column 3: Position Sizing & Systematic Sensitivity */}
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-ghost-border/60">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-ghost-cyan" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                      Position Sizing & Sensitivity
                    </h3>
                  </div>
                  <span className="text-2xs font-mono text-ghost-textMuted">RISK BUDGETING</span>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Max Position Cap:</span>
                    <span className="text-ghost-cyan font-bold text-sm">{(risk.position_sizing.max_position_pct * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Recommended Leverage:</span>
                    <span className="text-ghost-textPrimary font-bold">{risk.position_sizing.recommended_leverage}x</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Systematic Beta:</span>
                    <span className="text-ghost-textPrimary font-bold">{risk.sensitivity_metrics?.beta.toFixed(2) || '1.00'}x</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Benchmark Correlation:</span>
                    <span className="text-ghost-textPrimary">{((risk.sensitivity_metrics?.correlation_with_benchmark || 1.0) * 100).toFixed(1)}%</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-ghost-darkest border border-ghost-border text-2xs text-ghost-textMuted leading-relaxed mt-2">
                    <span className="text-ghost-cyan font-bold block mb-1">SIZING RATIONALE:</span>
                    {risk.position_sizing.rationale}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
