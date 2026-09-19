import { describe, it, expect, vi, beforeEach } from 'vitest';
import { portfolioService } from '../api/portfolioService';
import { apiClient } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('PortfolioService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPortfolio = {
    id: 'p-1',
    name: 'Core Portfolio',
    currency: 'USD',
    assets: [
      { id: 'a-1', symbol: 'ETH', quantity: 6.71, avg_entry_price: 0, source: 'Wallet', network: 'Ethereum', created_at: '', updated_at: '' },
    ],
    wallets: [
      { id: 'w-1', address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', network: 'Ethereum', asset_count: 1, created_at: '', updated_at: '' },
    ],
    updated_at: '',
  };

  it('fetches user portfolio', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockPortfolio } as any);
    const result = await portfolioService.getPortfolio();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/portfolio/me');
    expect(result).toEqual(mockPortfolio);
  });

  it('adds manual asset holding', async () => {
    const payload = { symbol: 'BTC', quantity: 0.5, avg_entry_price: 60000 };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { id: 'a-2', ...payload, source: 'Manual' } } as any);
    const result = await portfolioService.addManualAsset(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/portfolio/assets', payload);
    expect(result.symbol).toBe('BTC');
  });

  it('adds public read-only wallet', async () => {
    const payload = { address: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', network: 'Ethereum' };
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockPortfolio.wallets[0] } as any);
    const result = await portfolioService.addWallet(payload);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/portfolio/wallets', payload);
    expect(result.network).toBe('Ethereum');
  });

  it('removes wallet', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({} as any);
    await portfolioService.removeWallet('w-1');
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/portfolio/wallets/w-1');
  });
});
