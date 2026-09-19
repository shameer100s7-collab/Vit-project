import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Strategies } from '../pages/Strategies';
import { StrategyDetail } from '../pages/StrategyDetail';
import { strategiesApi, marketApi } from '../api';
import { StrategyItem, BacktestResult, OnChainProof, StrategyVerificationResult } from '../types';

const mockStrategies: StrategyItem[] = [
  {
    id: 'strat-1',
    name: 'BTC Trend Follower',
    description: 'Dual EMA crossover on 1h candles.',
    asset: 'BTC/USDT',
    timeframe: '1h',
    canonical_rules: { fast_period: 9, slow_period: 21 },
    strategy_hash: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
    ipfs_cid: 'bafkreitestcid1',
    is_onchain: true,
    tx_hash: '0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaa',
    contract_address: '0x8E192f16C2E2aB3f14A47E53DdB5683935393a55',
    block_number: 7481920,
    network: 'Ethereum Sepolia (ChainID: 11155111)',
    created_at: '2026-09-20T00:00:00Z',
    verification_badge: 'VERIFIED',
    verification_score: 84,
    total_return_pct: 28.5,
    win_rate: 62.0,
  },
];

const mockBacktest: BacktestResult = {
  backtest_run_id: 'BT-TEST1234',
  asset: 'BTC/USDT',
  timeframe: '1h',
  start_date: '2026-01-01T00:00:00Z',
  end_date: '2026-02-01T00:00:00Z',
  candle_count: 150,
  parameters: { initial_capital: 10000.0, fee_pct: 0.00075, slippage_pct: 0.0005 },
  performance: {
    initial_capital: 10000.0,
    final_capital: 12850.0,
    net_pnl: 2850.0,
    total_return_pct: 28.5,
    total_trades: 24,
    winning_trades: 15,
    losing_trades: 9,
    win_rate: 62.5,
    profit_factor: 1.95,
    max_drawdown: 8.4,
    sharpe_ratio: 1.68,
    sortino_ratio: 2.15,
    average_win: 250.0,
    average_loss: -100.0,
    largest_win: 450.0,
    largest_loss: -180.0,
    exposure_pct: 35.0,
  },
  equity_curve: [
    { timestamp: '2026-01-01T00:00:00Z', equity: 10000.0, drawdown_pct: 0.0 },
    { timestamp: '2026-01-15T00:00:00Z', equity: 11500.0, drawdown_pct: -2.1 },
    { timestamp: '2026-02-01T00:00:00Z', equity: 12850.0, drawdown_pct: 0.0 },
  ],
  trades_log: [],
  data_provenance: {
    data_source: 'Binance Spot Public REST',
    period: '2026-01-01 → 2026-02-01',
    backtest_run_id: 'BT-TEST1234',
    fee_model: '0.075% fee',
    slippage_model: '0.050% slippage',
  },
};

const mockProof: OnChainProof = {
  strategy_id: 'strat-1',
  strategy_hash: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
  ipfs_cid: 'bafkreitestcid1',
  blockchain_network: 'Ethereum Sepolia (ChainID: 11155111)',
  contract_address: '0x8E192f16C2E2aB3f14A47E53DdB5683935393a55',
  transaction_hash: '0x9999888877776666555544443333222211110000ffffeeeeddddccccbbbbaaaa',
  block_number: 7481920,
  registration_timestamp: '2026-09-20T00:00:00Z',
  status: 'REGISTERED',
  explorer_url: 'https://sepolia.etherscan.io/tx/0x9999',
  is_verified: true,
};

const mockVerif: StrategyVerificationResult = {
  strategy_id: 'strat-1',
  badge: 'VERIFIED',
  score: 84,
  score_breakdown: {
    data_completeness: 20,
    backtest_coverage: 20,
    sample_size: 15,
    onchain_proof: 15,
    anomaly_clearance: 20,
    max_score: 100,
  },
  performance_analysis: 'Healthy trend following performance across 150 historical bars.',
  risk_analysis: 'Maximum drawdown limited to 8.4% with 1.68 Sharpe ratio.',
  overfitting_analysis: 'Trade sample density is adequate. No single-trade curve fitting was detected.',
  anomalies: [],
  failure_conditions: [
    {
      condition: 'Sharp Adverse Momentum / Stop-Loss Breach',
      observed_performance: '2 stop-out events causing average loss of $120.00.',
      occurrences: 2,
      evidence: 'Triggered on sudden price drop.',
      affected_period: '2026-01-10',
    },
  ],
  data_provenance: {
    data_source: 'Binance Spot Public REST',
  },
};

describe('Strategies Platform Frontend Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(strategiesApi, 'list').mockResolvedValue(mockStrategies);
    vi.spyOn(strategiesApi, 'get').mockResolvedValue(mockStrategies[0]);
    vi.spyOn(strategiesApi, 'getLatestBacktest').mockResolvedValue(mockBacktest);
    vi.spyOn(strategiesApi, 'getOnChainProof').mockResolvedValue(mockProof);
    vi.spyOn(strategiesApi, 'getVerification').mockResolvedValue(mockVerif);
    vi.spyOn(strategiesApi, 'getPaperTradingStatus').mockResolvedValue({
      strategy_id: 'strat-1',
      asset: 'BTC/USDT',
      is_active: false,
      status: 'NOT_STARTED',
      current_price: 84000.0,
      realized_pnl: 0.0,
      unrealized_pnl: 0.0,
      total_trades: 0,
      win_rate: 0.0,
      last_signal: 'NONE',
      trades: [],
    });
    vi.spyOn(marketApi, 'getPrice').mockResolvedValue({
      data: {
        symbol: 'BTC',
        price: 84500.0,
        currency: 'USD',
        source: 'Binance Spot',
        timestamp: new Date().toISOString(),
      },
      metadata: {},
      status: 200,
      latencyMs: 10,
    });
    vi.spyOn(marketApi, 'getVolume').mockResolvedValue({
      data: {
        symbol: 'BTC',
        price_change_pct_24h: 3.42,
        volume_24h: 12500.0,
        quote_volume_24h: 980000000.0,
        high_24h: 85000.0,
        low_24h: 83000.0,
        source: 'Binance Spot',
        timestamp: new Date().toISOString(),
      },
      metadata: {},
      status: 200,
      latencyMs: 10,
    });
  });

  it('renders strategy marketplace with verification badge and register button', async () => {
    render(
      <MemoryRouter>
        <Strategies />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Strategy Verification Registry')).toBeInTheDocument();
      expect(screen.getByText('BTC Trend Follower')).toBeInTheDocument();
      expect(screen.getAllByText('VERIFIED').length).toBeGreaterThan(0);
      expect(screen.getByText('+28.5%')).toBeInTheDocument();
      expect(screen.getByText('Register Strategy')).toBeInTheDocument();
    });
  });

  it('opens strategy registration modal and shows canonical JSON preview', async () => {
    render(
      <MemoryRouter>
        <Strategies />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Register Strategy')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register Strategy'));

    expect(screen.getByText('Register Machine-Readable Strategy')).toBeInTheDocument();
    expect(screen.getByText('Canonical Machine-Readable Rules Preview')).toBeInTheDocument();
  });

  it('renders StrategyDetail verification dashboard with all 6 required sections', async () => {
    render(
      <MemoryRouter initialEntries={['/strategies/strat-1']}>
        <Routes>
          <Route path="/strategies/:id" element={<StrategyDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('BTC Trend Follower')).toBeInTheDocument();
      expect(screen.getByText('🟢 VERIFIED')).toBeInTheDocument();
    });

    expect(screen.getByText('ON-CHAIN STATUS')).toBeInTheDocument();
    expect(screen.getByText('BACKTEST STATUS')).toBeInTheDocument();
    expect(screen.getByText('PAPER TRADING')).toBeInTheDocument();
    expect(screen.getByText('VERIFICATION SCORE')).toBeInTheDocument();
    expect(screen.getByText('84 / 100')).toBeInTheDocument();
    expect(screen.getByText('LIVE MARKET DATA')).toBeInTheDocument();
    expect(screen.getByText('ON-CHAIN PROOF & CRYPTOGRAPHIC FOOTPRINT')).toBeInTheDocument();
    expect(screen.getByText('VERIFY ON BLOCKCHAIN')).toBeInTheDocument();
    expect(screen.getByText('REAL BACKTEST PERFORMANCE (BINANCE SPOT OHLCV)')).toBeInTheDocument();
    expect(screen.getAllByText('+28.5%').length).toBeGreaterThan(0);
    expect(screen.getByText('$2,850.00')).toBeInTheDocument();
    expect(screen.getByText('Equity Curve Timeline')).toBeInTheDocument();
    expect(screen.getByText('AI RISK & OVERFITTING ANALYSIS')).toBeInTheDocument();
    expect(screen.getByText('ANOMALIES & FAILURE CONDITIONS')).toBeInTheDocument();
    expect(screen.getByText('Zero critical anomalies detected across historical executions.')).toBeInTheDocument();
    expect(screen.getByText('DATA PROVENANCE & REPRODUCIBILITY')).toBeInTheDocument();
    expect(screen.getAllByText('BT-TEST1234').length).toBeGreaterThan(0);
  });

  it('opens the transparent "WHY THIS SCORE?" modal upon clicking WHY?', async () => {
    render(
      <MemoryRouter initialEntries={['/strategies/strat-1']}>
        <Routes>
          <Route path="/strategies/:id" element={<StrategyDetail />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('WHY?')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('WHY?'));

    expect(screen.getByText('Transparent Verification Score Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Data Completeness (OHLCV coverage > 50 bars)')).toBeInTheDocument();
    expect(screen.getAllByText('20 / 20 pts').length).toBeGreaterThan(0);
  });
});
