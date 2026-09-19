import React, { useEffect, useState, useCallback } from 'react';
import { riskApi } from '../api';
import { AssetRiskResult } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';
import { ShieldAlert, RefreshCw, Target, TrendingDown, Scale, ChevronRight } from 'lucide-react';

export const RiskDashboard: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [timeframe, setTimeframe] = useState<string>('1h');
  const benchmark = 'BTC/USDT';
  const [risk, setRisk] = useState<AssetRiskResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<any>(null);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);

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
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div>
          <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            Risk Assessment
          </h1>
          <p className="text-sm text-ghost-textMuted mt-0.5">
            Value at Risk (VaR), Expected Shortfall, Drawdown, and Position Sizing for {selectedSymbol}.
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
            onClick={fetchRisk}
            disabled={isLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-ghost-card border border-ghost-border rounded-lg hover:border-ghost-cyan/50 text-xs font-medium text-ghost-textPrimary hover:text-ghost-cyan transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-ghost-cyan' : ''}`} />
            <span>Re-evaluate</span>
          </button>
        </div>
      </div>

      {error && <ErrorState error={error} onRetry={fetchRisk} />}

      {isLoading ? (
        <LoadingState message="Calculating quantitative risk metrics..." />
      ) : risk ? (
        <div className="space-y-6">
          {/* Section 1: Executive Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Overall Risk Profile"
              value={risk.risk_level}
              badge={<RiskBadge label={risk.risk_level} size="sm" />}
              icon={<ShieldAlert className="w-4 h-4" />}
              variant={risk.risk_level === 'CRITICAL' || risk.risk_level === 'HIGH' ? 'red' : 'green'}
            />

            <MetricCard
              label="Annualized Volatility"
              value={`${(risk.volatility_annualized * 100).toFixed(1)}%`}
              subValue="Annualized standard deviation"
            />

            <MetricCard
              label="1D VaR (95% Confidence)"
              value={`${(risk.var_metrics.var_95_daily * 100).toFixed(2)}%`}
              subValue="Maximum expected 1-day loss"
              variant="red"
            />

            <MetricCard
              label="Recommended Position Cap"
              value={`${(risk.position_sizing.max_position_pct * 100).toFixed(0)}%`}
              subValue="Volatility-targeted allocation limit"
              variant="cyan"
              icon={<Target className="w-4 h-4" />}
            />
          </div>

          {/* Section 2: Loss Risk (VaR & CVaR) */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
              <h2 className="text-base font-semibold text-ghost-textPrimary">
                Value at Risk (VaR) & Expected Shortfall
              </h2>
              <span className="text-xs text-ghost-textMuted font-mono">1-Day Horizon</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-sans text-xs">
              <div className="p-3.5 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-1">
                <span className="text-ghost-textMuted font-medium">Parametric VaR (95%)</span>
                <div className="text-lg font-mono font-bold text-rose-400">
                  {(risk.var_metrics.parametric_var_95 * 100).toFixed(2)}%
                </div>
                <p className="text-[11px] text-ghost-textDim">Normal distribution assumption</p>
              </div>

              <div className="p-3.5 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-1">
                <span className="text-ghost-textMuted font-medium">Historical VaR (95%)</span>
                <div className="text-lg font-mono font-bold text-rose-400">
                  {(risk.var_metrics.historical_var_95 * 100).toFixed(2)}%
                </div>
                <p className="text-[11px] text-ghost-textDim">Empirical quantile observation</p>
              </div>

              <div className="p-3.5 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-1">
                <span className="text-ghost-textMuted font-medium">Expected Shortfall CVaR (95%)</span>
                <div className="text-lg font-mono font-bold text-rose-500">
                  {(risk.var_metrics.cvar_95_daily * 100).toFixed(2)}%
                </div>
                <p className="text-[11px] text-ghost-textDim">Average loss beyond 95% VaR</p>
              </div>

              <div className="p-3.5 bg-ghost-darkest/60 border border-ghost-border/60 rounded-lg space-y-1">
                <span className="text-ghost-textMuted font-medium">Extreme VaR (99%)</span>
                <div className="text-lg font-mono font-bold text-rose-600">
                  {(risk.var_metrics.var_99_daily * 100).toFixed(2)}%
                </div>
                <p className="text-[11px] text-ghost-textDim">99% confidence tail risk</p>
              </div>
            </div>
          </div>

          {/* Section 3: Performance & Sensitivity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Risk-Adjusted Ratios */}
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-base font-semibold text-ghost-textPrimary flex items-center gap-2">
                <Scale className="w-4 h-4 text-ghost-cyan" />
                <span>Risk-Adjusted Performance</span>
              </h2>

              <div className="space-y-2 font-sans text-xs">
                <div className="flex items-center justify-between p-3 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg">
                  <span className="text-ghost-textMuted font-medium">Sharpe Ratio</span>
                  <span className="font-mono font-bold text-ghost-textPrimary">
                    {risk.risk_adjusted_metrics.sharpe_ratio.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg">
                  <span className="text-ghost-textMuted font-medium">Sortino Ratio</span>
                  <span className="font-mono font-bold text-ghost-cyan">
                    {risk.risk_adjusted_metrics.sortino_ratio.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg">
                  <span className="text-ghost-textMuted font-medium">Calmar Ratio</span>
                  <span className="font-mono font-bold text-ghost-textPrimary">
                    {risk.risk_adjusted_metrics.calmar_ratio.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Drawdown & Market Sensitivity */}
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
              <h2 className="text-base font-semibold text-ghost-textPrimary flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-amber-400" />
                <span>Drawdown & Benchmark Sensitivity</span>
              </h2>

              <div className="space-y-2 font-sans text-xs">
                <div className="flex items-center justify-between p-3 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg">
                  <span className="text-ghost-textMuted font-medium">Maximum Drawdown (MDD)</span>
                  <span className="font-mono font-bold text-amber-400">
                    {(risk.drawdown_metrics.max_drawdown * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg">
                  <span className="text-ghost-textMuted font-medium">Systematic Beta vs Benchmark</span>
                  <span className="font-mono font-bold text-ghost-textPrimary">
                    {risk.sensitivity_metrics?.beta !== undefined ? risk.sensitivity_metrics.beta.toFixed(2) : '1.00'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg">
                  <span className="text-ghost-textMuted font-medium">Correlation</span>
                  <span className="font-mono font-bold text-ghost-textPrimary">
                    {risk.sensitivity_metrics?.correlation_with_benchmark !== undefined ? risk.sensitivity_metrics.correlation_with_benchmark.toFixed(2) : '1.00'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Progressive Disclosure Action */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ghost-textPrimary">Position Sizing Rationale</h3>
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-xs text-ghost-cyan hover:underline flex items-center gap-1 font-medium"
              >
                <span>{showTechnicalDetails ? 'Hide rationale' : 'View allocation rationale'}</span>
                <ChevronRight className={`w-3.5 h-3.5 transform transition-transform ${showTechnicalDetails ? 'rotate-90' : ''}`} />
              </button>
            </div>

            {showTechnicalDetails && (
              <div className="p-4 bg-ghost-darkest rounded-lg border border-ghost-border/80 text-xs text-ghost-textMuted space-y-2">
                <p className="text-ghost-textPrimary font-semibold">Quantitative Rationale:</p>
                <p>{risk.position_sizing.rationale}</p>
                <div className="pt-2 flex items-center gap-4 text-ghost-textDim font-mono text-2xs">
                  <span>Vol Scalar: {risk.position_sizing.volatility_scalar.toFixed(2)}</span>
                  <span>Max Leverage: {risk.position_sizing.recommended_leverage}x</span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};
