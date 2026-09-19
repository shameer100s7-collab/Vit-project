import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricCard } from '../components/common/MetricCard';
import { RiskBadge } from '../components/common/RiskBadge';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { AssetSelector } from '../components/common/AssetSelector';

describe('Common Quantitative Components', () => {
  it('renders MetricCard with label, value and subtext', () => {
    render(
      <MetricCard
        label="1D VaR (95%)"
        value="-2.45%"
        subValue="Parametric normal distribution"
      />
    );
    expect(screen.getByText('1D VaR (95%)')).toBeInTheDocument();
    expect(screen.getByText('-2.45%')).toBeInTheDocument();
    expect(screen.getByText('Parametric normal distribution')).toBeInTheDocument();
  });

  it('renders RiskBadge with appropriate styling for different levels', () => {
    const { rerender } = render(<RiskBadge label="LOW" />);
    expect(screen.getByText('LOW')).toBeInTheDocument();

    rerender(<RiskBadge label="CRITICAL" />);
    expect(screen.getByText('CRITICAL')).toBeInTheDocument();
  });

  it('renders LoadingState with custom message', () => {
    render(<LoadingState message="Fetching live order book..." />);
    expect(screen.getByText('Fetching live order book...')).toBeInTheDocument();
  });

  it('renders ErrorState and triggers retry', () => {
    let retried = false;
    render(
      <ErrorState
        error="Backend connection refused"
        onRetry={() => {
          retried = true;
        }}
      />
    );
    expect(screen.getByText('Backend connection refused')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /try again|retry/i });
    fireEvent.click(retryBtn);
    expect(retried).toBe(true);
  });

  it('allows AssetSelector to switch symbols', () => {
    let selected = 'BTC/USDT';
    render(
      <AssetSelector
        selectedSymbol={selected}
        onSelectSymbol={(sym) => {
          selected = sym;
        }}
      />
    );
    expect(screen.getByText('BTC/USDT')).toBeInTheDocument();
    const triggerBtn = screen.getByRole('button', { name: /BTC\/USDT/i });
    fireEvent.click(triggerBtn);

    const ethOption = screen.getByRole('button', { name: /ETH\/USDT/i });
    fireEvent.click(ethOption);
    expect(selected).toBe('ETH/USDT');
  });
});
