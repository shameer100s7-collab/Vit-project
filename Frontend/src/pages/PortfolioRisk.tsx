import React, { useState } from 'react';
import { riskApi } from '../api';
import { PortfolioRiskResult, PortfolioAssetInput } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { ActualBalances } from '../components/common/ActualBalances';
import { PieChart, Plus, Trash2, ShieldAlert, Play } from 'lucide-react';

export const PortfolioRisk: React.FC = () => {
  const [portfolioName, setPortfolioName] = useState('Core Portfolio');
  const [benchmarkSymbol] = useState('BTC/USDT');
  const [assets, setAssets] = useState<PortfolioAssetInput[]>([
    { symbol: 'BTC/USDT', weight: 0.5 },
    { symbol: 'ETH/USDT', weight: 0.3 },
    { symbol: 'SOL/USDT', weight: 0.2 },
  ]);

  const [newSymbol, setNewSymbol] = useState('');
  const [newWeight, setNewWeight] = useState('');

  const [result, setResult] = useState<PortfolioRiskResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const handleAddAsset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSymbol.trim()) return;
    const w = parseFloat(newWeight) || 0.1;
    setAssets([...assets, { symbol: newSymbol.trim().toUpperCase(), weight: w }]);
    setNewSymbol('');
    setNewWeight('');
  };

  const handleRemoveAsset = (index: number) => {
    setAssets(assets.filter((_, i) => i !== index));
  };

  const handleNormalizeWeights = () => {
    const total = assets.reduce((sum, a) => sum + a.weight, 0);
    if (total <= 0) return;
    setAssets(assets.map((a) => ({ ...a, weight: Number((a.weight / total).toFixed(4)) })));
  };

  const handleEvaluate = async () => {
    if (assets.length === 0) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await riskApi.evaluatePortfolioRisk({
        portfolio_name: portfolioName,
        benchmark_symbol: benchmarkSymbol,
        assets: assets.map((a) => ({ symbol: a.symbol, weight: Number(a.weight) })),
      });
      setResult(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  };

  const totalWeight = assets.reduce((acc, curr) => acc + Number(curr.weight), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-ghost-border">
        <div>
          <h1 className="text-2xl font-bold text-ghost-textPrimary tracking-tight">
            Portfolio Overview & Risk
          </h1>
          <p className="text-sm text-ghost-textMuted mt-0.5">
            Multi-asset allocation, concentration index, and marginal risk attribution.
          </p>
        </div>

        <button
          onClick={handleEvaluate}
          disabled={isLoading || assets.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-ghost-cyan text-slate-950 font-semibold text-xs rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Evaluate Risk</span>
        </button>
      </div>

      {error && <ErrorState error={error} onRetry={handleEvaluate} />}

      {/* Actual Balances from Backend */}
      <ActualBalances />

      {/* Allocation Input Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Asset Allocation */}
        <div className="lg:col-span-2 bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-ghost-border/50">
            <h2 className="text-base font-semibold text-ghost-textPrimary flex items-center gap-2">
              <PieChart className="w-4 h-4 text-ghost-cyan" />
              <span>Asset Allocation Breakdown</span>
            </h2>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNormalizeWeights}
                className="text-xs text-ghost-cyan hover:underline font-medium"
              >
                Normalize Weights to 100%
              </button>
            </div>
          </div>

          {/* Allocation Table */}
          <div className="space-y-2 font-sans text-xs">
            {assets.map((item, idx) => (
              <div
                key={idx}
                className="p-3 bg-ghost-darkest/60 border border-ghost-border/50 rounded-lg flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-ghost-textPrimary">{item.symbol}</span>
                  <span className="text-ghost-textDim">Target Weight</span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-ghost-cyan">
                    {(item.weight * 100).toFixed(1)}%
                  </span>
                  <button
                    onClick={() => handleRemoveAsset(idx)}
                    className="p-1 text-ghost-textMuted hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Total Weight Bar */}
          <div className="pt-2 flex items-center justify-between text-xs">
            <span className="text-ghost-textMuted font-medium">Total Portfolio Weight:</span>
            <span
              className={`font-mono font-bold ${
                Math.abs(totalWeight - 1.0) < 0.01 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {(totalWeight * 100).toFixed(1)}% {Math.abs(totalWeight - 1.0) >= 0.01 && '(Unnormalized)'}
            </span>
          </div>

          {/* Add Asset Form */}
          <form onSubmit={handleAddAsset} className="pt-3 border-t border-ghost-border/40 flex items-center gap-3 text-xs">
            <input
              type="text"
              placeholder="Asset (e.g. SOL/USDT)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              className="flex-1 bg-ghost-darkest border border-ghost-border/80 rounded-lg px-3 py-2 text-ghost-textPrimary placeholder:text-ghost-textDim focus:outline-none focus:border-ghost-cyan font-mono"
            />
            <input
              type="number"
              step="0.05"
              placeholder="Weight (0.2)"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              className="w-28 bg-ghost-darkest border border-ghost-border/80 rounded-lg px-3 py-2 text-ghost-textPrimary placeholder:text-ghost-textDim focus:outline-none focus:border-ghost-cyan font-mono"
            />
            <button
              type="submit"
              className="px-3 py-2 bg-ghost-darkest border border-ghost-border hover:border-ghost-cyan rounded-lg text-ghost-textPrimary hover:text-ghost-cyan transition-colors flex items-center gap-1.5 font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
        </div>

        {/* Right Col: Portfolio Controls & Info */}
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4 text-xs font-sans">
          <h3 className="text-base font-semibold text-ghost-textPrimary">Portfolio Parameters</h3>

          <div className="space-y-3">
            <div>
              <label className="block text-ghost-textMuted mb-1 font-medium">Portfolio Name</label>
              <input
                type="text"
                value={portfolioName}
                onChange={(e) => setPortfolioName(e.target.value)}
                className="w-full bg-ghost-darkest border border-ghost-border/80 rounded-lg px-3 py-2 text-ghost-textPrimary focus:outline-none focus:border-ghost-cyan font-mono"
              />
            </div>

            <div>
              <label className="block text-ghost-textMuted mb-1 font-medium">Benchmark Reference</label>
              <input
                type="text"
                disabled
                value={benchmarkSymbol}
                className="w-full bg-ghost-darkest/60 border border-ghost-border/40 rounded-lg px-3 py-2 text-ghost-textDim font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Evaluation Results */}
      {isLoading ? (
        <LoadingState message="Computing portfolio covariance matrix and risk contributions..." />
      ) : result ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="Portfolio Risk Level"
              value={result.risk_level}
              badge={<RiskBadge label={result.risk_level} size="sm" />}
              icon={<ShieldAlert className="w-4 h-4" />}
              variant={result.risk_level === 'HIGH' || result.risk_level === 'CRITICAL' ? 'red' : 'green'}
            />

            <MetricCard
              label="Portfolio Volatility"
              value={`${(result.portfolio_volatility_annualized * 100).toFixed(1)}%`}
              subValue="Annualized standard deviation"
            />

            <MetricCard
              label="Concentration (HHI)"
              value={result.concentration.normalized_hhi.toFixed(2)}
              subValue="Herfindahl-Hirschman Index [0.0 - 1.0]"
              variant={result.concentration.normalized_hhi > 0.4 ? 'amber' : 'green'}
            />

            <MetricCard
              label="Effective Uncorrelated Assets"
              value={result.concentration.effective_assets.toFixed(1)}
              subValue={`Out of ${assets.length} total holdings`}
              variant="cyan"
            />
          </div>

          {/* Marginal Risk Attribution Bar Chart Breakdown */}
          <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-ghost-textPrimary">
              Marginal Risk Contribution (MRC) Attribution
            </h2>

            <div className="space-y-3 font-sans text-xs">
              {Object.entries(result.marginal_risk_contributions).map(([symbol, mrc]) => (
                <div key={symbol} className="space-y-1.5">
                  <div className="flex justify-between items-center text-ghost-textPrimary">
                    <span className="font-mono font-bold">{symbol}</span>
                    <span className="font-mono text-ghost-cyan font-bold">{(mrc * 100).toFixed(1)}% Risk Contribution</span>
                  </div>
                  <div className="w-full bg-ghost-darkest h-2 rounded-full overflow-hidden border border-ghost-border/40">
                    <div
                      className="bg-ghost-cyan h-full rounded-full"
                      style={{ width: `${Math.round(mrc * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
