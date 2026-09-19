import { describe, it, expect, beforeEach, vi } from 'vitest';
import { balanceService } from '../api/balanceService';

describe('BalanceService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches balances successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({
        success: true,
        data: [
          { symbol: 'BTC/USDT', quantity: 1.5 },
          { symbol: 'ETH/USDT', quantity: 10.0 }
        ]
      })
    });

    const balances = await balanceService.getBalances();
    expect(balances).toHaveLength(2);
    expect(balances[0].symbol).toBe('BTC/USDT');
    expect(balances[0].quantity).toBe(1.5);
  });

  it('gracefully handles 404 by returning empty array', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ detail: 'Not Found' })
    });

    const balances = await balanceService.getBalances();
    expect(balances).toEqual([]);
  });

  it('throws error for other status codes like 500', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ detail: 'Server Error' })
    });

    await expect(balanceService.getBalances()).rejects.toThrow('Failed to fetch user balances.');
  });
});
