import React, { useState } from 'react';
import { riskApi } from '../api';
import { PortfolioRiskResult, PortfolioAssetInput } from '../types';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { PieChart, Plus, Trash2, ShieldAlert, Layers, Percent, Play } from 'lucide-react';

export const PortfolioRisk: React.FC = () => {
  const [portfolioName, setPortfolioName] = useState('CoreQuantPortfolio');
  const [benchmarkSymbol, setBenchmarkSymbol] = useState('BTC/USDT');
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-ghost-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-mono font-bold tracking-tight text-ghost-textPrimary uppercase">
              Portfolio Risk & Covariance Engine
            </h1>
            <span className="px-2 py-0.5 rounded text-2xs font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              POST /api/v1/risk/portfolio
            </span>
          </div>
          <p className="text-xs font-mono text-ghost-textMuted mt-0.5">
            Cross-asset variance decomposition, HHI capital concentration, and marginal risk attribution
          </p>
        </div>

        <button
          onClick={handleEvaluate}
          disabled={isLoading || assets.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-ghost-cyan text-ghost-darkest font-mono font-bold text-xs rounded-lg hover:bg-ghost-cyan/90 transition-colors shadow-lg disabled:opacity-50 tracking-wider uppercase"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Simulate Portfolio</span>
        </button>
      </div>

      {error && <ErrorState error={error} onRetry={handleEvaluate} />}

      {/* Allocation Input & Configuration Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Asset Allocation Matrix */}
        <div className="lg:col-span-2 bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-ghost-border/60">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-ghost-cyan" />
              <h2 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                Asset Allocation Matrix
              </h2>
            </div>
            <div className="flex items-center gap-3 font-mono text-2xs">
              <span className={Math.abs(totalWeight - 1.0) < 0.01 ? 'text-ghost-green' : 'text-ghost-amber'}>
                Total Weight: {(totalWeight * 100).toFixed(1)}%
              </span>
              <button
                type="button"
                onClick={handleNormalizeWeights}
                className="px-2 py-0.5 rounded bg-ghost-border hover:bg-ghost-borderLight text-ghost-textPrimary transition-colors"
              >
                Auto-Normalize to 100%
              </button>
            </div>
          </div>

          <div className="space-y-2 mb-4 font-mono text-xs">
            {assets.map((asset, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-ghost-darkest border border-ghost-border/80"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xs text-ghost-textMuted w-4">#{idx + 1}</span>
                  <span className="font-bold text-ghost-textPrimary">{asset.symbol}</span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 bg-ghost-card px-2 py-1 rounded border border-ghost-border">
                    <Percent className="w-3 h-3 text-ghost-textMuted" />
                    <input
                      type="number"
                      step="0.05"
                      min="0.01"
                      max="1.0"
                      value={asset.weight}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const copy = [...assets];
                        copy[idx].weight = val;
                        setAssets(copy);
                      }}
                      className="w-16 bg-transparent text-right text-xs font-mono text-ghost-textPrimary focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => handleRemoveAsset(idx)}
                    className="p-1.5 text-ghost-textMuted hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Add Asset Form */}
          <form onSubmit={handleAddAsset} className="flex gap-2 pt-3 border-t border-ghost-border/40 font-mono text-xs">
            <input
              type="text"
              placeholder="Symbol (e.g. AVAX/USDT)"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value)}
              className="flex-1 px-3 py-1.5 bg-ghost-darkest border border-ghost-border rounded-lg text-ghost-textPrimary placeholder:text-ghost-textMuted focus:outline-none focus:border-ghost-cyan"
            />
            <input
              type="number"
              step="0.05"
              placeholder="Weight (0.2)"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
              className="w-28 px-3 py-1.5 bg-ghost-darkest border border-ghost-border rounded-lg text-ghost-textPrimary placeholder:text-ghost-textMuted focus:outline-none focus:border-ghost-cyan"
            />
            <button
              type="submit"
              className="px-3 py-1.5 bg-ghost-card border border-ghost-border hover:border-ghost-cyan rounded-lg text-ghost-textPrimary hover:text-ghost-cyan flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>
        </div>

        {/* Right 1 Col: Portfolio Metadata Settings */}
        <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg font-mono text-xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-ghost-border/60">
            <PieChart className="w-4 h-4 text-ghost-cyan" />
            <h3 className="font-bold uppercase tracking-wider text-ghost-textPrimary">
              Evaluation Parameters
            </h3>
          </div>

          <div>
            <label className="block text-2xs text-ghost-textMuted uppercase mb-1">Portfolio Title</label>
            <input
              type="text"
              value={portfolioName}
              onChange={(e) => setPortfolioName(e.target.value)}
              className="w-full px-3 py-1.5 bg-ghost-darkest border border-ghost-border rounded-lg text-ghost-textPrimary focus:outline-none focus:border-ghost-cyan"
            />
          </div>

          <div>
            <label className="block text-2xs text-ghost-textMuted uppercase mb-1">Benchmark Symbol</label>
            <input
              type="text"
              value={benchmarkSymbol}
              onChange={(e) => setBenchmarkSymbol(e.target.value)}
              className="w-full px-3 py-1.5 bg-ghost-darkest border border-ghost-border rounded-lg text-ghost-textPrimary focus:outline-none focus:border-ghost-cyan"
            />
          </div>

          <div className="p-3 rounded-lg bg-ghost-darkest border border-ghost-border/60 text-2xs text-ghost-textMuted space-y-1">
            <span className="text-ghost-cyan font-bold block mb-1">COVARIANCE AGGREGATION:</span>
            <p>Calculates empirical sample covariance matrix across historical candle streams, evaluates portfolio synthetic returns, and computes marginal risk contributions.</p>
          </div>
        </div>
      </div>

      {/* Results Section */}
      {isLoading && <LoadingState message="Decomposing portfolio covariance and concentration metrics..." />}

      {result && !isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              label="PORTFOLIO RISK LEVEL"
              value={result.risk_level}
              badge={<RiskBadge label={result.risk_level} variant="risk" size="sm" />}
              icon={<ShieldAlert className="w-4 h-4" />}
              variant={result.risk_level === 'CRITICAL' ? 'red' : result.risk_level === 'HIGH' ? 'amber' : 'green'}
            />
            <MetricCard
              label="ANNUALIZED VOLATILITY"
              value={`${(result.portfolio_volatility_annualized * 100).toFixed(1)}%`}
              subValue="Cross-asset diversified variance"
              variant="default"
            />
            <MetricCard
              label="PORTFOLIO 1-DAY 95% VaR"
              value={`${(result.portfolio_var_95_daily * 100).toFixed(2)}%`}
              subValue={`CVaR: ${(result.portfolio_cvar_95_daily * 100).toFixed(2)}%`}
              variant="cyan"
            />
            <MetricCard
              label="HHI CONCENTRATION"
              value={result.concentration.hhi.toFixed(3)}
              subValue={`Effective Assets: ${result.concentration.effective_assets} uncorr bets`}
              variant={result.concentration.normalized_hhi > 0.5 ? 'amber' : 'green'}
            />
          </div>

          {/* Marginal Risk Contributions & Component Risks Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panel 1: Marginal Risk Contribution (MRC) */}
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-ghost-border/60">
                <div className="flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-ghost-cyan" />
                  <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                    Marginal Risk Contribution (MRC)
                  </h3>
                </div>
                <span className="text-2xs font-mono text-ghost-textMuted">Σ MRC = 100%</span>
              </div>

              <div className="space-y-3 font-mono text-xs">
                {Object.entries(result.marginal_risk_contributions).map(([sym, mrc]) => (
                  <div key={sym} className="p-3 rounded-lg bg-ghost-darkest border border-ghost-border/60">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-ghost-textPrimary">{sym}</span>
                      <span className="text-ghost-cyan font-bold">{(mrc * 100).toFixed(1)}% of Risk</span>
                    </div>
                    <div className="w-full h-1.5 bg-ghost-border/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-ghost-cyan rounded-full"
                        style={{ width: `${Math.min(100, Math.max(0, mrc * 100))}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-2xs text-ghost-textMuted mt-1">
                      <span>Allocation Weight: {((result.concentration.asset_weights[sym] || 0) * 100).toFixed(1)}%</span>
                      <span>Variance Share</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Panel 2: Portfolio Performance & Drawdowns */}
            <div className="bg-ghost-card border border-ghost-border rounded-xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 mb-4 border-b border-ghost-border/60">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-ghost-cyan" />
                    <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-ghost-textPrimary">
                      Aggregate Portfolio Analytics
                    </h3>
                  </div>
                  <span className="text-2xs font-mono text-ghost-textMuted">
                    {result.portfolio_name || 'Simulated Core'}
                  </span>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Portfolio Sharpe Ratio:</span>
                    <span className="font-bold text-ghost-green">{result.portfolio_sharpe_ratio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Portfolio Sortino Ratio:</span>
                    <span className="font-bold text-ghost-green">{result.portfolio_sortino_ratio.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Portfolio Max Drawdown:</span>
                    <span className="font-bold text-ghost-red">{(result.max_drawdown * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Top Asset Weight:</span>
                    <span className="font-bold text-ghost-textPrimary">{(result.concentration.top_asset_weight * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-ghost-border/40">
                    <span className="text-ghost-textMuted">Normalized HHI (0-1):</span>
                    <span className="font-bold text-ghost-cyan">{result.concentration.normalized_hhi.toFixed(3)}</span>
                  </div>
                </div>
              </div>

              {result.analysis_id && (
                <div className="mt-4 pt-3 border-t border-ghost-border/40 text-2xs font-mono text-ghost-textMuted flex justify-between">
                  <span>RECORD PERSISTED:</span>
                  <span className="text-ghost-cyan font-bold">{result.analysis_id.slice(0, 8)}...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
