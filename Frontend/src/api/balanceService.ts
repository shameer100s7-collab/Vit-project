import { apiClient } from './client';

export interface BalanceItem {
  symbol: string;
  quantity: number;
}

class BalanceService {
  /**
   * Fetches the user's authenticated balances from the GHOST backend.
   * If the endpoint does not exist yet (404) or fails, it gracefully handles the error
   * and returns an empty array, allowing the UI to remain functional.
   */
  async getBalances(): Promise<BalanceItem[]> {
    try {
      // Intentionally pointing to the backend portfolio endpoint which might not exist yet.
      const response = await apiClient.get<BalanceItem[]>('/api/v1/portfolio/balances');
      return response.data;
    } catch (error: any) {
      // Gracefully handle 404 (Not Found) or 401 (Unauthorized)
      if (error.status === 404) {
        console.warn('[BalanceService] Balance endpoint not found on backend. Returning empty balances.');
        return [];
      }
      
      console.error('[BalanceService] Failed to fetch balances:', error);
      throw new Error('Failed to fetch user balances.');
    }
  }
}

export const balanceService = new BalanceService();
