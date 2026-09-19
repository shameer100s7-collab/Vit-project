import { apiClient } from './client';

export interface TradingProfile {
  capital: number;
  currency: string;
  riskPerTrade: number;
  dailyLossLimit: number;
  riskRewardPreference: string;
  experienceLevel: 'Beginner' | 'Intermediate' | 'Advanced';
  markets: string[];
  tradingStyle: string;
}

class ProfileService {
  private readonly LOCAL_STORAGE_KEY = 'ghost_temp_trading_profile';

  /**
   * Fetches the user's trading profile.
   * If the backend endpoint is missing, falls back to localStorage for UX testing purposes.
   */
  async getProfile(): Promise<TradingProfile | null> {
    try {
      const response = await apiClient.get<TradingProfile>('/api/v1/users/me/trading-profile');
      return response.data;
    } catch (error: any) {
      if (error.status === 404) {
        console.warn('[ProfileService] Backend endpoint /api/v1/users/me/trading-profile not found. Falling back to local storage.');
        const local = localStorage.getItem(this.LOCAL_STORAGE_KEY);
        if (local) {
          return JSON.parse(local) as TradingProfile;
        }
        return null;
      }
      throw new Error('Failed to fetch trading profile.');
    }
  }

  /**
   * Updates the user's trading profile.
   * If the backend endpoint is missing, saves to localStorage for UX testing purposes.
   */
  async updateProfile(profile: TradingProfile): Promise<TradingProfile> {
    try {
      const response = await apiClient.put<TradingProfile>('/api/v1/users/me/trading-profile', {
        body: JSON.stringify(profile)
      });
      return response.data;
    } catch (error: any) {
      if (error.status === 404) {
        console.warn('[ProfileService] Backend endpoint /api/v1/users/me/trading-profile not found. Saving to local storage.');
        localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(profile));
        return profile;
      }
      throw new Error('Failed to update trading profile.');
    }
  }
}

export const profileService = new ProfileService();
