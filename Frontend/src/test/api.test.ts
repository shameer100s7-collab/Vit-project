import { describe, it, expect, beforeEach, vi } from 'vitest';
import { apiClient, marketApi } from '../api';

describe('API Client and Market Endpoint Normalization', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('correctly normalizes currency symbols for backend path parameters', () => {
    expect(marketApi.normalizeSymbol('BTC/USDT')).toBe('BTC-USDT');
    expect(marketApi.normalizeSymbol('ETH-USDT')).toBe('ETH-USDT');
    expect(marketApi.normalizeSymbol('SOL/USDT')).toBe('SOL-USDT');
  });

  it('includes Authorization header when token exists in storage', async () => {
    localStorage.setItem('ghost_access_token', 'test-jwt-token-12345');

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ status: 'healthy' }),
    });
    global.fetch = fetchMock;

    await apiClient.get('/api/v1/health');

    expect(fetchMock).toHaveBeenCalled();
    const calledHeaders: Headers = fetchMock.mock.calls[0][1].headers;
    expect(calledHeaders.get('Authorization')).toBe('Bearer test-jwt-token-12345');
  });

  it('normalizes network and HTTP errors accurately', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => ({ detail: 'Asset not supported' }),
    });

    try {
      await apiClient.get('/api/v1/market/UNKNOWN-USDT');
      expect.fail('Should have thrown an ApiError');
    } catch (err: any) {
      expect(err.status).toBe(404);
      expect(err.message).toBe('Asset not supported');
    }
  });
});
