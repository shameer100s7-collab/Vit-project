import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Signals } from '../pages/Signals';
import { signalsApi } from '../api';
import { MarketContextResult } from '../types';

vi.mock('../api', () => ({
  signalsApi: {
    analyzeContext: vi.fn(),
    checkQuality: vi.fn(),
    getSignal: vi.fn(),
    getHistory: vi.fn(),
  },
}));

const mockQualityFailedResult: MarketContextResult = {
  asset: 'BTC/USDT',
  timeframe: '1H',
  evidence_quality: 'INSUFFICIENT',
  market_state: {
    state: 'MIXED / UNCLEAR',
    summary: 'Visual information insufficient for reliable market-context classification.',
  },
  market_map: {
    price: 'Unreadable from submitted visual data',
    structure: 'Insufficient visual resolution',
    time: 'Undefined',
    volume: 'Not visible',
    range: 'Unclear',
    location: 'Unclear',
    candle_behavior: 'Unclear',
  },
  supporting_evidence: [],
  conflicting_evidence: [],
  current_context: 'Image quality check failed. Please submit a clearer chart.',
  what_to_watch: [],
  limitations: ['Image clarity insufficient for structural feature extraction.'],
  quality_gate: {
    quality_gate_passed: false,
    clarity_rating: 'INSUFFICIENT',
    reasons: [
      'Image resolution 400x300 is below the recommended minimum of 640x480',
      'Insufficient contrast (12.4 < 18.0); candle details may be washed out',
    ],
    candle_bodies_visible: false,
    wicks_visible: false,
    volume_visible: false,
    price_scale_visible: false,
    error_title: 'CHART CLARITY INSUFFICIENT',
    error_message: 'The screenshot does not provide enough visual information for reliable market-context analysis.',
  },
  timestamp: '2026-09-19T22:00:00Z',
};

const mockSuccessfulResult: MarketContextResult = {
  asset: 'BTC/USDT',
  timeframe: '1H',
  evidence_quality: 'HIGH',
  market_state: {
    state: 'TRENDING',
    summary: 'Sustained expansion characterized by sequential higher highs and higher lows.',
  },
  market_map: {
    price: 'Observing continuous bid progression at $82,450.',
    structure: 'Defended higher low at $81,200 with break of prior intermediate swing high at $82,000.',
    time: 'Trailing 36 hourly bars establishing consecutive progressive closes.',
    volume: 'Expanding volume histogram during expansion candles with lower volume on pullbacks.',
    range: 'Active trading range defined between $80,500 support and $83,000 swing resistance.',
    location: 'Upper quartile of the established multi-day range; probing prior distribution ceiling.',
    candle_behavior: 'Wide-range impulsive bull candles with minimal upper wicks indicating aggressive market absorption.',
  },
  supporting_evidence: [
    'Consecutive higher lows established across the trailing 24 hours.',
    'Volume expansion aligns with directional expansion above $82,000.',
    'Closing prices consistently holding in the upper 25% of candle ranges.',
  ],
  conflicting_evidence: [
    'Approaching significant overhead structural resistance at $83,000.',
    'Volume profile thinning out near local highs, indicating potential exhaustion if fresh bids do not materialize.',
  ],
  current_context:
    'Price is currently exhibiting sustained upside expansion within the upper quartile of its recent range. Pullbacks have been absorbed above $81,200 with declining volume.',
  what_to_watch: [
    'Acceptance below $81,200 swing low on elevated volume would invalidate the immediate higher-low structural integrity.',
    'Sustained consolidation above $83,000 with expanding volume would indicate absorption of prior overhead resistance.',
  ],
  limitations: ['Lower-timeframe intraday order flow dynamics not captured.'],
  quality_gate: {
    quality_gate_passed: true,
    clarity_rating: 'HIGH',
    reasons: ['Resolution exceeds recommended 640x480 minimum.'],
    candle_bodies_visible: true,
    wicks_visible: true,
    volume_visible: true,
    price_scale_visible: true,
  },
  multi_timeframe_synthesis: '1H expansion is aligned with 4H structural breakout above key moving averages.',
  multi_timeframe_levels: [
    {
      timeframe: '4H',
      structure_summary: 'Higher timeframe macro breakout holding above 50 EMA.',
      context_role: 'HIGHER_TIMEFRAME',
    },
    {
      timeframe: '1H',
      structure_summary: 'Local continuation channel with higher highs and lows.',
      context_role: 'CURRENT_TIMEFRAME',
    },
  ],
  live_market_comparison: {
    source: 'Binance Spot',
    live_price: 82450,
  },
  timestamp: '2026-09-19T22:00:00Z',
};

describe('Signals — Market Context Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial intake interface with core philosophy and 3 intake steps', () => {
    render(
      <BrowserRouter>
        <Signals />
      </BrowserRouter>
    );

    // Philosophy banner
    expect(screen.getByText('SIGNAL')).toBeInTheDocument();
    expect(screen.getByText('Market Context Engine')).toBeInTheDocument();
    expect(
      screen.getByText('"We don\'t generate trading signals. We generate market context."')
    ).toBeInTheDocument();

    // 3 Intake Steps
    expect(screen.getByText(/STEP 1/i)).toBeInTheDocument();
    expect(screen.getByText(/STEP 2/i)).toBeInTheDocument();
    expect(screen.getByText(/STEP 3/i)).toBeInTheDocument();

    // Timeframe selector buttons
    expect(screen.getByRole('button', { name: '1H' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '4H' })).toBeInTheDocument();

    // Multi-timeframe toggle
    expect(screen.getByLabelText(/Attach Supplementary Higher-Timeframe Screenshot/i)).toBeInTheDocument();
  });

  it('shows error when Analyze is clicked without uploading a screenshot', async () => {
    render(
      <BrowserRouter>
        <Signals />
      </BrowserRouter>
    );

    const analyzeButton = screen.getByRole('button', { name: /Analyze Market Context/i });
    expect(analyzeButton).toBeDisabled();
  });

  it('displays CHART CLARITY INSUFFICIENT when Quality Gate fails', async () => {
    vi.mocked(signalsApi.analyzeContext).mockResolvedValueOnce({
      data: mockQualityFailedResult,
    } as any);

    const { container } = render(
      <BrowserRouter>
        <Signals />
      </BrowserRouter>
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    const file = new File(['fake blurry image content'], 'blurry_chart.png', { type: 'image/png' });

    const originalFileReader = window.FileReader;
    class MockFileReader {
      result = 'data:image/png;base64,blurrydata';
      onloadend: (() => void) | null = null;
      readAsDataURL() {
        if (this.onloadend) this.onloadend();
      }
    }
    window.FileReader = MockFileReader as any;

    fireEvent.change(fileInput, { target: { files: [file] } });

    const analyzeButton = await screen.findByRole('button', { name: /Analyze Market Context/i });
    expect(analyzeButton).not.toBeDisabled();
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('CHART CLARITY INSUFFICIENT')).toBeInTheDocument();
    });

    expect(
      screen.getByText('The screenshot does not provide enough visual information for reliable market-context analysis.')
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Image resolution 400x300 is below the recommended minimum of 640x480/i)
    ).toBeInTheDocument();

    const resetButton = screen.getByRole('button', { name: /Upload Clearer Screenshot/i });
    fireEvent.click(resetButton);

    expect(screen.queryByText('CHART CLARITY INSUFFICIENT')).not.toBeInTheDocument();

    window.FileReader = originalFileReader;
  });

  it('renders full Market Context Engine output on successful analysis', async () => {
    vi.mocked(signalsApi.analyzeContext).mockResolvedValueOnce({
      data: mockSuccessfulResult,
    } as any);

    const { container } = render(
      <BrowserRouter>
        <Signals />
      </BrowserRouter>
    );

    const originalFileReader = window.FileReader;
    class MockFileReader {
      result = 'data:image/png;base64,clearchartdata';
      onloadend: (() => void) | null = null;
      readAsDataURL() {
        if (this.onloadend) this.onloadend();
      }
    }
    window.FileReader = MockFileReader as any;

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).not.toBeNull();
    const file = new File(['fake clear image content'], 'clean_chart.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const analyzeButton = await screen.findByRole('button', { name: /Analyze Market Context/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('TRENDING')).toBeInTheDocument();
    });
    expect(screen.getByText('Sustained expansion characterized by sequential higher highs and higher lows.')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();

    // 7-Dimension Market Map
    expect(screen.getByText('MARKET MAP')).toBeInTheDocument();
    expect(screen.getByText('Observing continuous bid progression at $82,450.')).toBeInTheDocument();
    expect(screen.getByText('Defended higher low at $81,200 with break of prior intermediate swing high at $82,000.')).toBeInTheDocument();
    expect(screen.getByText('Trailing 36 hourly bars establishing consecutive progressive closes.')).toBeInTheDocument();
    expect(screen.getByText('Expanding volume histogram during expansion candles with lower volume on pullbacks.')).toBeInTheDocument();
    expect(screen.getByText('Active trading range defined between $80,500 support and $83,000 swing resistance.')).toBeInTheDocument();
    expect(screen.getByText('Upper quartile of the established multi-day range; probing prior distribution ceiling.')).toBeInTheDocument();
    expect(screen.getByText('Wide-range impulsive bull candles with minimal upper wicks indicating aggressive market absorption.')).toBeInTheDocument();

    // Supporting & Conflicting Evidence
    expect(screen.getByText('SUPPORTING EVIDENCE')).toBeInTheDocument();
    expect(screen.getByText('Consecutive higher lows established across the trailing 24 hours.')).toBeInTheDocument();
    expect(screen.getByText('CONFLICTING / LIMITING EVIDENCE')).toBeInTheDocument();
    expect(screen.getByText('Approaching significant overhead structural resistance at $83,000.')).toBeInTheDocument();

    // Current Context
    expect(screen.getByText('CURRENT CONTEXT')).toBeInTheDocument();
    expect(
      screen.getByText(/Price is currently exhibiting sustained upside expansion within the upper quartile of its recent range/i)
    ).toBeInTheDocument();

    // What to Watch
    expect(screen.getByText('WHAT TO WATCH')).toBeInTheDocument();
    expect(screen.getByText(/Acceptance below \$81,200 swing low/i)).toBeInTheDocument();

    // Multi-timeframe synthesis
    expect(screen.getByText('HIERARCHICAL MULTI-TIMEFRAME SYNTHESIS')).toBeInTheDocument();
    expect(screen.getByText('1H expansion is aligned with 4H structural breakout above key moving averages.')).toBeInTheDocument();

    // Data limitations
    expect(screen.getByText('Data Limitations Disclosed:')).toBeInTheDocument();
    expect(screen.getByText('Lower-timeframe intraday order flow dynamics not captured.')).toBeInTheDocument();

    // Verify absence of forbidden signal keywords
    expect(screen.queryByText(/BUY NOW/i)).toBeNull();
    expect(screen.queryByText(/SELL NOW/i)).toBeNull();
    expect(screen.queryByText(/STOP LOSS/i)).toBeNull();
    expect(screen.queryByText(/TAKE PROFIT/i)).toBeNull();

    window.FileReader = originalFileReader;
  });
});
