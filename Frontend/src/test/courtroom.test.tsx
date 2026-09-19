import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Courtroom } from '../pages/Courtroom';
import { EvidenceModal } from '../components/courtroom/EvidenceModal';
import { courtroomApi } from '../api/courtroom';
import { CourtroomArgument, CourtroomCase } from '../types';

const mockCase: CourtroomCase = {
  case_id: 'CASE-GHOST-7742',
  symbol: 'BTCUSDT',
  timeframe: '4h',
  user_thesis: 'I think BTC is bullish because momentum is increasing.',
  detected_stance: 'BULLISH',
  status: 'IN_SESSION',
  market_snapshot: {
    symbol: 'BTCUSDT',
    price: 82500,
    high_24h: 84000,
    low_24h: 81000,
    rsi_14: 62.5,
    source: 'Binance Spot',
  },
  prosecution_arguments: [
    {
      id: 'PA-1',
      role: 'PROSECUTION',
      claim: 'Momentum is failing to confirm the bullish thesis.',
      observation: 'RSI(14) has declined by 3.2 points despite higher prices.',
      why_it_matters: 'Momentum divergence suggests weakening buyer exhaustion.',
      strength: 'Moderate',
      source: 'Binance Spot',
      updated_ago: '0.4s ago',
      evidence_items: [
        {
          id: 'EV-1',
          type: 'indicator',
          hierarchy: 'Derived indicator',
          name: 'RSI Momentum & MACD',
          value: { rsi_14: 62.5 },
          threshold_or_condition: 'RSI Delta < 0',
          observation: 'RSI delta negative over trailing 4h candles.',
          direction: 'Opposing',
          strength: 'Moderate',
          source: 'Binance Spot',
          event_time: '2026-09-19T20:00:00Z',
          retrieved_at: '2026-09-19T20:00:01Z',
        },
      ],
    },
  ],
  defense_arguments: [
    {
      id: 'DA-1',
      role: 'DEFENSE',
      claim: 'The market maintains structural support above 20 SMA.',
      observation: 'Price ($82,500) defends the 20 SMA and swing low.',
      why_it_matters: 'Higher-low sequence remains defended against sellers.',
      strength: 'Strong',
      source: 'Binance Spot',
      updated_ago: '0.4s ago',
      evidence_items: [
        {
          id: 'EV-2',
          type: 'price_action',
          hierarchy: 'Direct market observation',
          name: 'Baseline Support',
          value: { price: 82500 },
          threshold_or_condition: 'Price > 20 SMA',
          observation: 'Price holds firmly above 20 SMA.',
          direction: 'Supporting',
          strength: 'Strong',
          source: 'Binance Spot',
          event_time: '2026-09-19T20:00:00Z',
          retrieved_at: '2026-09-19T20:00:01Z',
        },
      ],
    },
  ],
  cross_examination: [
    {
      dimension: 'Momentum & Velocity',
      supporting_evidence: 'RSI at 62.5 is above 50 baseline.',
      opposing_evidence: 'RSI delta is negative over last 2 candles.',
      conflict_assessment: 'Baseline remains bullish but acceleration is fading.',
      severity: 'MODERATE',
    },
    {
      dimension: 'Trend Structure',
      supporting_evidence: 'Price maintains above swing low.',
      opposing_evidence: 'Price is capped below 24h high.',
      conflict_assessment: 'Trend intact but upside resistance is nearby.',
      severity: 'LOW',
    },
  ],
  verdict: 'PARTIALLY SUPPORTED',
  verdict_rationale: 'The bullish thesis has meaningful support, but fading momentum creates notable friction.',
  invalidation_conditions: [
    {
      condition_type: 'BULLISH_INVALIDATION',
      description: 'Price breaks and closes below $81,000 swing low.',
      price_reference: 81000,
      rationale: 'Breaks higher-low sequence.',
    },
  ],
  data_sources: ['Binance Spot', 'GHOST Feature Engine'],
  evidence_count: 2,
  created_at: '2026-09-19T20:00:00Z',
};

describe('Courtroom Frontend Suite', () => {
  it('renders Courtroom intake form with required labels and sample chips', () => {
    render(
      <BrowserRouter>
        <Courtroom />
      </BrowserRouter>
    );

    expect(screen.getByText('COURTROOM')).toBeInTheDocument();
    expect(screen.getByText(/"Challenge your market thesis before you act."/i)).toBeInTheDocument();
    expect(screen.getByText('What is your thesis?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /open court/i })).toBeInTheDocument();
  });

  it('populates thesis input when clicking a sample prompt chip', () => {
    render(
      <BrowserRouter>
        <Courtroom />
      </BrowserRouter>
    );

    const chip = screen.getByText(/"I think BTC is bullish because momentum is in.../i);
    fireEvent.click(chip);

    const textarea = screen.getByPlaceholderText(/I think Bitcoin is bullish because/i) as HTMLTextAreaElement;
    expect(textarea.value).toContain('I think BTC is bullish');
  });

  it('renders EvidenceModal with granular telemetry and closes properly', () => {
    const mockArg: CourtroomArgument = mockCase.prosecution_arguments[0];
    let closed = false;

    render(
      <EvidenceModal
        argument={mockArg}
        onClose={() => {
          closed = true;
        }}
      />
    );

    expect(screen.getByText('PROSECUTION COUNSEL EVIDENCE')).toBeInTheDocument();
    expect(screen.getByText(mockArg.claim)).toBeInTheDocument();
    expect(screen.getByText(mockArg.why_it_matters)).toBeInTheDocument();
    expect(screen.getByText('RSI Momentum & MACD')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /close modal/i });
    fireEvent.click(closeBtn);
    expect(closed).toBe(true);
  });

  it('submits case and renders active proceeding tabs and verdict', async () => {
    vi.spyOn(courtroomApi, 'createCase').mockResolvedValue({
      data: mockCase,
      metadata: {},
      status: 200,
      latencyMs: 50,
    });

    render(
      <BrowserRouter>
        <Courtroom />
      </BrowserRouter>
    );

    const textarea = screen.getByPlaceholderText(/I think Bitcoin is bullish because/i);
    fireEvent.change(textarea, { target: { value: 'I think BTC is bullish because momentum is increasing.' } });

    const submitBtn = screen.getByRole('button', { name: /open court/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('CASE-GHOST-7742')).toBeInTheDocument();
    });

    expect(screen.getByText('IN_SESSION')).toBeInTheDocument();
    expect(screen.getByText('BULLISH THESIS')).toBeInTheDocument();

    // Navigate to Prosecution tab
    const prosecutionTab = screen.getByRole('button', { name: /2\. Prosecution/i });
    fireEvent.click(prosecutionTab);
    expect(screen.getByText(/Prosecution: The Case Against Your Thesis/i)).toBeInTheDocument();
    expect(screen.getByText('Momentum is failing to confirm the bullish thesis.')).toBeInTheDocument();

    // Navigate to Defense tab
    const defenseTab = screen.getByRole('button', { name: /3\. Defense/i });
    fireEvent.click(defenseTab);
    expect(screen.getByText(/Defense: The Case For Your Thesis/i)).toBeInTheDocument();
    expect(screen.getByText('The market maintains structural support above 20 SMA.')).toBeInTheDocument();

    // Navigate to Cross-Exam tab
    const crossExamTab = screen.getByRole('button', { name: /4\. Cross-Exam/i });
    fireEvent.click(crossExamTab);
    expect(screen.getByText(/Cross-Examination: Evidence Conflict Matrix/i)).toBeInTheDocument();
    expect(screen.getByText('Momentum & Velocity')).toBeInTheDocument();

    // Navigate to Verdict tab
    const verdictTab = screen.getByRole('button', { name: /5\. Verdict & Rules/i });
    fireEvent.click(verdictTab);
    expect(screen.getByText('PARTIALLY SUPPORTED')).toBeInTheDocument();
    expect(screen.getByText(/What Would Invalidate This Thesis\?/i)).toBeInTheDocument();
    expect(screen.getByText('Price breaks and closes below $81,000 swing low.')).toBeInTheDocument();
  });
});
