import { api, ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY } from './client';
import { TokenResponse, User, UserLoginRequest, UserRegisterRequest } from '../types';

export const authApi = {
  /** POST /api/v1/auth/register */
  register: async (payload: UserRegisterRequest) => {
    return api.post<User>('/api/v1/auth/register', payload, { skipAuth: true });
  },

  /** POST /api/v1/auth/login */
  login: async (payload: UserLoginRequest) => {
    const res = await api.post<TokenResponse>('/api/v1/auth/login', payload, { skipAuth: true });
    if (res.data.access_token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, res.data.access_token);
      localStorage.setItem(REFRESH_TOKEN_KEY, res.data.refresh_token);
    }
    return res;
  },

  /** POST /api/v1/auth/refresh */
  refresh: async (refreshToken: string) => {
    return api.post<TokenResponse>('/api/v1/auth/refresh', { refresh_token: refreshToken }, { skipAuth: true });
  },

  /** POST /api/v1/auth/logout */
  logout: async () => {
    try {
      await api.post<Record<string, string>>('/api/v1/auth/logout');
    } finally {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },

  /** GET /api/v1/auth/me */
  getMe: async () => {
    return api.get<User>('/api/v1/auth/me');
  },
};
