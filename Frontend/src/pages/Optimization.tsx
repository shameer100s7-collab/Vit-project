import React, { useState } from 'react';
import { api, ApiError } from '../api/client';
import { MetricCard } from '../components/common/MetricCard';
import { Maximize2, Play, AlertCircle, Sliders } from 'lucide-react';

export const Optimization: React.FC = () => {
  const [method, setMethod] = useState<'MEAN_VARIANCE' | 'RISK_PARITY' | 'MAX_SHARPE'>('MAX_SHARPE');
  const [riskAversion, setRiskAversion] = useState<number>(3.0);
  const [minAllocation, setMinAllocation] = useState<number>(0.05);
  const [maxAllocation, setMaxAllocation] = useState<number>(0.40);
  const [hhiLimit, setHhiLimit] = useState<number>(0.35);

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
      // Probe backend endpoint
      const res = await api.post('/api/v1/portfolio/optimize', payload);
      setBackendEndpointStatus('ENDPOINT_ACTIVE');
      setSimulatedResult(res.data);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 404) {
        setBackendEndpointStatus('NOT_YET_IMPLEMENTED');
        // Provide analytical client preview matching target allocation schema
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
          diagnostics: 'Simulated preview. Backend POST /api/v1/portfolio/optimize scheduled for Phase 11/12.',
          warnings: ['Simulated allocations are for mathematical testing only.'],
        });
      } else {
        setBackendEndpointStatus(`ERROR_${err.status || 'NETWORK'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ghost-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-ghost-textPrimary uppercase">
              Portfolio Optimization Console
            </h1>
            <span className="px-2 py-0.5 rounded text-2xs font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30">
              TARGET ALLOCATION ONLY
            </span>
          </div>
          <p className="text-xs font-mono text-ghost-textMuted mt-0.5">
            Mean-Variance, Risk Parity, and Maximum Sharpe portfolio allocation optimizer
          </p>
        </div>

        <button
          onClick={handleRunOptimization}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-ghost-cyan text-ghost-darkest font-bold rounded-lg hover:bg-ghost-cyan/90 transition-colors shadow-lg disabled:opacity-50 uppercase tracking-wider text-xs"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>{isLoading ? 'Probing Engine...' : 'Run Optimization'}</span>
        </button>
      </div>

      {/* Backend Status Notification */}
      {backendEndpointStatus === 'NOT_YET_IMPLEMENTED' && (
        <div className="p-4 rounded-xl bg-ghost-card border border-amber-500/40 text-amber-300 flex items-start gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold uppercase tracking-wider text-xs text-amber-300">
              Backend Endpoint Discovery: POST /api/v1/portfolio/optimize
            </div>
            <p className="text-2xs text-amber-200/80 mt-1 leading-relaxed">
              The backend returned <strong className="text-white">404 NOT_FOUND</strong>. The Portfolio Optimization service layer is scheduled for Phase 11/12.
              The frontend successfully tested the connectivity and activated the simulation preview mode below.
            </p>
          </div>
        </div>
      )}

      {/* Configuration & Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Target Assets & Parameters */}
        <div className="lg:col-span-2 bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-ghost-border/60">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-ghost-cyan" />
              <h3 className="font-bold uppercase tracking-wider text-ghost-textPrimary">
                Target Universe & Expected Alpha
              </h3>
            </div>
            <span className="text-2xs text-ghost-textMuted">{assets.length} Assets Selected</span>
          </div>

          <div className="space-y-2">
            {assets.map((a, i) => (
              <div key={i} className="p-3 rounded-lg bg-ghost-darkest border border-ghost-border flex justify-between items-center text-xs">
                <span className="font-bold text-ghost-textPrimary">{a.symbol}</span>
                <div className="flex items-center gap-4 text-2xs text-ghost-textMuted">
                  <span>Current: {(a.currentWeight * 100).toFixed(0)}%</span>
                  <span>Exp Return: <strong className="text-ghost-green">{(a.expectedReturn * 100).toFixed(0)}%</strong></span>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-2xs text-ghost-textMuted uppercase mb-1">Min Weight Cap</label>
              <input
                type="number"
                step="0.01"
                value={minAllocation}
                onChange={(e) => setMinAllocation(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-ghost-darkest border border-ghost-border rounded-lg text-ghost-textPrimary"
              />
            </div>
            <div>
              <label className="block text-2xs text-ghost-textMuted uppercase mb-1">Max Weight Cap</label>
              <input
                type="number"
                step="0.01"
                value={maxAllocation}
                onChange={(e) => setMaxAllocation(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-ghost-darkest border border-ghost-border rounded-lg text-ghost-textPrimary"
              />
            </div>
            <div>
              <label className="block text-2xs text-ghost-textMuted uppercase mb-1">HHI Limit</label>
              <input
                type="number"
                step="0.05"
                value={hhiLimit}
                onChange={(e) => setHhiLimit(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-1.5 bg-ghost-darkest border border-ghost-border rounded-lg text-ghost-textPrimary"
              />
            </div>
          </div>
        </div>

        {/* Right 1 Col: Algorithm Method & Risk Aversion */}
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-ghost-border/60">
            <Maximize2 className="w-4 h-4 text-ghost-cyan" />
            <h3 className="font-bold uppercase tracking-wider text-ghost-textPrimary">
              Algorithm Setup
            </h3>
          </div>

          <div>
            <label className="block text-2xs text-ghost-textMuted uppercase mb-1">Methodology</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-full px-3 py-2 bg-ghost-darkest border border-ghost-border rounded-lg text-ghost-textPrimary focus:border-ghost-cyan"
            >
              <option value="MAX_SHARPE">Maximum Sharpe Ratio</option>
              <option value="RISK_PARITY">Equal Risk Parity (ERC)</option>
              <option value="MEAN_VARIANCE">Markowitz Mean-Variance</option>
            </select>
          </div>

          <div>
            <label className="block text-2xs text-ghost-textMuted uppercase mb-1">
              Risk Aversion Factor (λ: {riskAversion.toFixed(1)})
            </label>
            <input
              type="range"
              min="1.0"
              max="10.0"
              step="0.5"
              value={riskAversion}
              onChange={(e) => setRiskAversion(parseFloat(e.target.value))}
              className="w-full accent-ghost-cyan"
            />
          </div>

          <div className="p-3 rounded-lg bg-ghost-darkest border border-ghost-border/60 text-2xs text-ghost-textMuted space-y-1">
            <span className="text-ghost-cyan font-bold block mb-1">STRICT CONSTRAINT:</span>
            <p>GHOST never executes automated trading orders. Optimization outputs are exclusively target weight recommendations.</p>
          </div>
        </div>
      </div>

      {/* Optimization Results */}
      {simulatedResult && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="OPTIMIZATION STATUS"
              value={simulatedResult.status}
              variant="cyan"
            />
            <MetricCard
              label="EXPECTED RETURN"
              value={`${(simulatedResult.expected_return * 100).toFixed(1)}%`}
              subValue="Annualized forecast"
              variant="green"
            />
            <MetricCard
              label="EXPECTED VOLATILITY"
              value={`${(simulatedResult.expected_volatility * 100).toFixed(1)}%`}
              subValue={`Sharpe: ${simulatedResult.sharpe_ratio.toFixed(2)}`}
              variant="default"
            />
            <MetricCard
              label="ESTIMATED HHI"
              value={simulatedResult.hhi.toFixed(3)}
              subValue={`Turnover: ${(simulatedResult.turnover * 100).toFixed(1)}%`}
              variant="default"
            />
          </div>

          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-ghost-border/60">
              <h3 className="font-bold uppercase tracking-wider text-ghost-textPrimary">
                Optimal Target Allocations
              </h3>
              <span className="text-2xs text-ghost-textMuted">Algorithm: {simulatedResult.method}</span>
            </div>

            <div className="space-y-3">
              {Object.entries(simulatedResult.target_weights).map(([sym, weight]: any) => (
                <div key={sym} className="p-3 rounded-lg bg-ghost-darkest border border-ghost-border/80">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-ghost-textPrimary">{sym}</span>
                    <span className="text-ghost-cyan font-bold text-sm">{(weight * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-ghost-border/40 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-ghost-cyan rounded-full transition-all duration-500"
                      style={{ width: `${weight * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
