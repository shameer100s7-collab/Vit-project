import { api } from './client';
import { HealthResponse } from '../types';

export const healthApi = {
  /** Root health probe: GET /health */
  getRootHealth: () => api.get<{ status: string; service: string; version: string }>('/health', { skipAuth: true }),

  /** Root service discovery: GET / */
  getRootDiscovery: () => api.get<Record<string, any>>('/', { skipAuth: true }),

  /** API v1 health probe: GET /api/v1/health */
  getApiHealth: () => api.get<HealthResponse>('/api/v1/health', { skipAuth: true }),
};
