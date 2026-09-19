import { apiClient } from './client';

export interface PortfolioAssetItem {
  id: string;
  symbol: string;
  quantity: number;
  avg_entry_price: number;
  source: 'Wallet' | 'Manual' | string;
  network?: string;
  wallet_id?: string;
  created_at: string;
  updated_at: string;
}

export interface WalletItem {
  id: string;
  address: string;
  network: string;
  label?: string;
  asset_count: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioData {
  id: string;
  name: string;
  currency: string;
  assets: PortfolioAssetItem[];
  wallets: WalletItem[];
  updated_at: string;
}

export interface AddAssetPayload {
  symbol: string;
  quantity: number;
  avg_entry_price?: number;
  network?: string;
}

export interface UpdateAssetPayload {
  quantity: number;
  avg_entry_price?: number;
}

export interface AddWalletPayload {
  address: string;
  network: string;
  label?: string;
}

class PortfolioService {
  /** GET /api/v1/portfolio/me */
  async getPortfolio(): Promise<PortfolioData> {
    try {
      const response = await apiClient.get<PortfolioData>('/api/v1/portfolio/me');
      return response.data;
    } catch (error: any) {
      console.error('[PortfolioService] Failed to fetch portfolio:', error);
      throw error;
    }
  }

  /** POST /api/v1/portfolio/assets */
  async addManualAsset(payload: AddAssetPayload): Promise<PortfolioAssetItem> {
    const response = await apiClient.post<PortfolioAssetItem>('/api/v1/portfolio/assets', payload);
    return response.data;
  }

  /** PUT /api/v1/portfolio/assets/{id} */
  async updateAsset(assetId: string, payload: UpdateAssetPayload): Promise<PortfolioAssetItem> {
    const response = await apiClient.put<PortfolioAssetItem>(`/api/v1/portfolio/assets/${assetId}`, payload);
    return response.data;
  }

  /** DELETE /api/v1/portfolio/assets/{id} */
  async removeAsset(assetId: string): Promise<void> {
    await apiClient.delete(`/api/v1/portfolio/assets/${assetId}`);
  }

  async removeManualAsset(assetId: string): Promise<void> {
    return this.removeAsset(assetId);
  }

  /** POST /api/v1/portfolio/wallets */
  async addWallet(payload: AddWalletPayload): Promise<WalletItem> {
    const response = await apiClient.post<WalletItem>('/api/v1/portfolio/wallets', payload);
    return response.data;
  }

  /** DELETE /api/v1/portfolio/wallets/{id} */
  async removeWallet(walletId: string): Promise<void> {
    await apiClient.delete(`/api/v1/portfolio/wallets/${walletId}`);
  }

  /** POST /api/v1/portfolio/wallets/{id}/refresh */
  async refreshWallet(walletId: string): Promise<WalletItem> {
    const response = await apiClient.post<WalletItem>(`/api/v1/portfolio/wallets/${walletId}/refresh`);
    return response.data;
  }

  /** POST /api/v1/portfolio/refresh-all */
  async refreshAllWallets(): Promise<void> {
    await apiClient.post('/api/v1/portfolio/refresh-all');
  }
}

export const portfolioService = new PortfolioService();
