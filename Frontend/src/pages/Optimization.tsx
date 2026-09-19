import React, { useState } from 'react';
import { api, ApiError } from '../api/client';
import { MetricCard } from '../components/common/MetricCard';
import { Play, Sliders, Info } from 'lucide-react';

export const Optimization: React.FC = () => {
  const [method, setMethod] = useState<'MEAN_VARIANCE' | 'RISK_PARITY' | 'MAX_SHARPE'>('MAX_SHARPE');
  const [riskAversion, setRiskAversion] = useState<number>(3.0);
  const [minAllocation, setMinAllocation] = useState<number>(0.05);
  const [maxAllocation, setMaxAllocation] = useState<number>(0.40);
  const [hhiLimit] = useState<number>(0.35);

  const [assets] = useState([
    { symbol: 'BTC/USDT', expectedReturn: 0.25, currentWeight: 0.50 },
    { symbol: 'ETH/USDT', expectedReturn: 0.35, currentWeight: 0.30 },
    { symbol: 'SOL/USDT', expectedReturn: 0.45, currentWeight: 0.20 },
  ]);

  const [isLoading, setIsLoading] = useState(false);
  const [backendEndpointStatus, setBackendEndpointStatus] = useState<string | null>(null);
  const [simulatedResult, setSimulatedResult] = useState<any | null>(null);

  const handleRunOptimization = async () => {
    setIsLoading(true);
    setBackendEndpointStatus(null);
    setSimulatedResult(null);

    const payload = {
      method,
      risk_aversion: riskAversion,
      min_allocation: minAllocation,
      max_allocation: maxAllocation,
      hhi_limit: hhiLimit,
      assets,
    };

    try {
      const res = await api.post('/api/v1/portfolio/optimize', payload);
      setBackendEndpointStatus('ENDPOINT_ACTIVE');
      setSimulatedResult(res.data);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) {
        setBackendEndpointStatus('NOT_YET_IMPLEMENTED');
        setSimulatedResult({
          status: 'SIMULATION_PREVIEW',
          method,
          target_weights: {
            'BTC/USDT': 0.38,
            'ETH/USDT': 0.34,
            'SOL/USDT': 0.28,
          },
          expected_return: 0.34,
          expected_volatility: 0.26,
          sharpe_ratio: 1.31,
          var_95: 0.028,
          cvar_95: 0.036,
          hhi: 0.338,
          turnover: 0.16,
          constraints: {
            min_allocation: minAllocation,
            max_allocation: maxAllocation,
            hhi_limit: hhiLimit,
          },
          diagnostics: 'Simulated allocation preview. Backend optimization scheduled for Phase 11/12.',
          warnings: ['Target allocations are calculated for mathematical preview.'],
        });
      } else {
        setBackendEndpointStatus(`ERROR_${err.status || 'NETWORK'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div>
          <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            Portfolio Optimization
          </h1>
          <p className="text-sm text-ghost-textMuted mt-0.5">
            Find a portfolio allocation that balances expected return and risk under your selected constraints.
          </p>
        </div>

        <button
          onClick={handleRunOptimization}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-ghost-burgundy hover:bg-[#6c1219] text-ghost-sand border border-ghost-sand/30 font-semibold text-xs rounded-lg shadow-md transition-colors disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Optimize Portfolio</span>
        </button>
      </div>

      {/* Constraints & Settings Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-ghost-textPrimary flex items-center gap-2">
            <Sliders className="w-4 h-4 text-ghost-sand" />
            <span>Optimization Parameters</span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-ghost-textMuted mb-1 font-medium">Optimization Objective</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="w-full bg-ghost-darkest border border-ghost-border/80 rounded-lg px-3 py-2 text-ghost-textPrimary focus:outline-none focus:border-ghost-sand font-mono"
              >
                <option value="MAX_SHARPE">Maximum Sharpe Ratio</option>
                <option value="RISK_PARITY">Risk Parity (Equal Risk Contribution)</option>
                <option value="MEAN_VARIANCE">Mean-Variance Optimization</option>
              </select>
            </div>

            <div>
              <label className="block text-ghost-textMuted mb-1 font-medium">Risk Aversion Factor: {riskAversion}</label>
              <input
                type="range"
                min="1.0"
                max="10.0"
                step="0.5"
                value={riskAversion}
                onChange={(e) => setRiskAversion(parseFloat(e.target.value))}
                className="w-full accent-ghost-sand"
              />
            </div>

            <div>
              <label className="block text-ghost-textMuted mb-1 font-medium">Min Allocation per Asset: {(minAllocation * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0.0"
                max="0.2"
                step="0.01"
                value={minAllocation}
                onChange={(e) => setMinAllocation(parseFloat(e.target.value))}
                className="w-full accent-ghost-sand"
              />
            </div>

            <div>
              <label className="block text-ghost-textMuted mb-1 font-medium">Max Allocation per Asset: {(maxAllocation * 100).toFixed(0)}%</label>
              <input
                type="range"
                min="0.2"
                max="0.8"
                step="0.05"
                value={maxAllocation}
                onChange={(e) => setMaxAllocation(parseFloat(e.target.value))}
                className="w-full accent-ghost-sand"
              />
            </div>
          </div>
        </div>

        {/* Current Asset Weights Overview */}
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-3">
          <h3 className="text-base font-semibold text-ghost-textPrimary">Current Assets</h3>
          <div className="space-y-2 font-mono">
            {assets.map((a) => (
              <div key={a.symbol} className="p-2.5 bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg flex justify-between items-center">
                <span>{a.symbol}</span>
                <span className="text-ghost-sand font-bold">{(a.currentWeight * 100).toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Results Section */}
      {simulatedResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Expected Return"
              value={`${(simulatedResult.expected_return * 100).toFixed(1)}%`}
              variant="green"
            />
            <MetricCard
              label="Expected Volatility"
              value={`${(simulatedResult.expected_volatility * 100).toFixed(1)}%`}
            />
            <MetricCard
              label="Optimized Sharpe"
              value={simulatedResult.sharpe_ratio.toFixed(2)}
              variant="cyan"
            />
            <MetricCard
              label="Turnover Required"
              value={`${(simulatedResult.turnover * 100).toFixed(0)}%`}
            />
          </div>

          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-ghost-textPrimary">
              Recommended Target Allocations
            </h2>

            <div className="space-y-3 font-mono">
              {Object.entries(simulatedResult.target_weights).map(([symbol, weight]: any) => (
                <div key={symbol} className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span>{symbol}</span>
                    <span className="text-ghost-sand font-bold">{(weight * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-ghost-darkest h-2 rounded-full overflow-hidden border border-ghost-border/40">
                    <div className="bg-ghost-sand h-full rounded-full" style={{ width: `${Math.round(weight * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>

            {backendEndpointStatus === 'NOT_YET_IMPLEMENTED' && (
              <div className="p-3.5 bg-ghost-darkest/80 border border-ghost-border/80 rounded-lg text-ghost-textMuted flex items-start gap-2.5">
                <Info className="w-4 h-4 text-ghost-sand shrink-0 mt-0.5" />
                <p className="font-sans text-xs">
                  {simulatedResult.diagnostics}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
