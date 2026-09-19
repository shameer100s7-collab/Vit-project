import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileService, TradingProfile } from '../api/profileService';
import { apiClient } from '../api/client';
import { ApiError } from '../api/client';

vi.mock('../api/client', () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, _code: string, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

describe('ProfileService', () => {
  const LOCAL_KEY = 'ghost_temp_trading_profile';
  
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  const mockProfile: TradingProfile = {
    capital: 10000,
    currency: 'USD',
    riskPerTrade: 1,
    dailyLossLimit: 2,
    riskRewardPreference: '1 : 2',
    experienceLevel: 'Intermediate',
    markets: ['BTC/USDT'],
    tradingStyle: 'Swing',
  };

  it('fetches profile successfully from backend', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: mockProfile } as any);
    const result = await profileService.getProfile();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/users/me/trading-profile');
    expect(result).toEqual(mockProfile);
  });

  it('falls back to local storage when backend returns 404', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'Not found'));
    localStorage.setItem(LOCAL_KEY, JSON.stringify(mockProfile));
    
    const result = await profileService.getProfile();
    expect(apiClient.get).toHaveBeenCalled();
    expect(result).toEqual(mockProfile);
  });

  it('returns null when local storage is empty and backend returns 404', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'Not found'));
    
    const result = await profileService.getProfile();
    expect(result).toBeNull();
  });

  it('throws error for other get failures', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new ApiError(500, 'SERVER_ERROR', 'Server error'));
    
    await expect(profileService.getProfile()).rejects.toThrow('Failed to fetch trading profile.');
  });

  it('updates profile successfully on backend', async () => {
    vi.mocked(apiClient.put).mockResolvedValueOnce({ data: mockProfile } as any);
    const result = await profileService.updateProfile(mockProfile);
    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/users/me/trading-profile', { body: JSON.stringify(mockProfile) });
    expect(result).toEqual(mockProfile);
  });

  it('saves to local storage when update backend returns 404', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce(new ApiError(404, 'NOT_FOUND', 'Not found'));
    
    const result = await profileService.updateProfile(mockProfile);
    expect(apiClient.put).toHaveBeenCalled();
    expect(result).toEqual(mockProfile);
    expect(localStorage.getItem(LOCAL_KEY)).toEqual(JSON.stringify(mockProfile));
  });

  it('throws error for other update failures', async () => {
    vi.mocked(apiClient.put).mockRejectedValueOnce(new ApiError(500, 'SERVER_ERROR', 'Server error'));
    
    await expect(profileService.updateProfile(mockProfile)).rejects.toThrow('Failed to update trading profile.');
  });
});
