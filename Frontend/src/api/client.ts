/**
 * Centralized GHOST API Client
 * Features:
 * - Environment-configured base URL (VITE_API_BASE_URL)
 * - Automatic Authorization header injection
 * - Transparent 401 token refresh & request retry
 * - Standardized error extraction matching backend envelope
 * - Request correlation & latency tracking
 */

import { StandardErrorResponse, StandardSuccessResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface ApiRequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
}

export const formatSymbolForApi = (symbol: string): string => {
  if (!symbol) return '';
  return symbol.replace('/', '-').trim();
};

export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: any;
  public requestId?: string;

  constructor(status: number, code: string, message: string, details?: any, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

// Token Storage Keys
export const ACCESS_TOKEN_KEY = 'ghost_access_token';
export const REFRESH_TOKEN_KEY = 'ghost_refresh_token';

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function subscribeTokenRefresh(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

export async function apiClient<T>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<{ data: T; metadata: Record<string, any>; status: number; latencyMs: number }> {
  const { timeoutMs = 15000, skipAuth = false, ...fetchOptions } = options;

  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const headers = new Headers(fetchOptions.headers || {});

  if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Inject JWT access token if available and not skipped
  if (!skipAuth) {
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const startTime = performance.now();

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Math.round(performance.now() - startTime);

    // Handle 401 Unauthorized with token refresh rotation
    if (response.status === 401 && !skipAuth && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (refreshToken) {
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const refreshRes = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refresh_token: refreshToken }),
            });

            if (refreshRes.ok) {
              const refreshJson: StandardSuccessResponse<{ access_token: string; refresh_token: string }> = await refreshRes.json();
              localStorage.setItem(ACCESS_TOKEN_KEY, refreshJson.data.access_token);
              localStorage.setItem(REFRESH_TOKEN_KEY, refreshJson.data.refresh_token);
              isRefreshing = false;
              onRefreshed(refreshJson.data.access_token);
              // Retry original request with renewed access token
              return apiClient<T>(endpoint, options);
            } else {
              // Refresh failed, clear session
              localStorage.removeItem(ACCESS_TOKEN_KEY);
              localStorage.removeItem(REFRESH_TOKEN_KEY);
              isRefreshing = false;
              window.dispatchEvent(new Event('ghost_auth_expired'));
            }
          } catch (err) {
            isRefreshing = false;
            localStorage.removeItem(ACCESS_TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
            window.dispatchEvent(new Event('ghost_auth_expired'));
          }
        } else {
          // Wait for active refresh to complete
          return new Promise((resolve, reject) => {
            subscribeTokenRefresh(async (newToken: string) => {
              headers.set('Authorization', `Bearer ${newToken}`);
              try {
                const retryRes = await fetch(url, { ...fetchOptions, headers });
                const retryJson = await retryRes.json();
                resolve({ data: retryJson.data || retryJson, metadata: retryJson.metadata || {}, status: retryRes.status, latencyMs });
              } catch (retryErr) {
                reject(retryErr);
              }
            });
          });
        }
      }
    }

    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorEnvelope = json as StandardErrorResponse;
      const errorCode = errorEnvelope?.error?.code || `HTTP_${response.status}`;
      const errorMessage =
        errorEnvelope?.error?.message ||
        (json as any)?.detail ||
        response.statusText ||
        'An unexpected server error occurred';
      const requestId = errorEnvelope?.request_id || response.headers.get('X-Request-ID') || undefined;
      throw new ApiError(response.status, errorCode, errorMessage, errorEnvelope?.error?.details, requestId);
    }

    const successEnvelope = json as StandardSuccessResponse<T>;
    return {
      data: (successEnvelope.data !== undefined ? successEnvelope.data : json) as T,
      metadata: successEnvelope.metadata || {},
      status: response.status,
      latencyMs,
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) {
      throw error;
    }
    if (error.name === 'AbortError') {
      throw new ApiError(408, 'REQUEST_TIMEOUT', `Request timed out after ${timeoutMs}ms.`);
    }
    throw new ApiError(0, 'NETWORK_ERROR', 'Unable to connect to GHOST backend at ' + BASE_URL);
  }
}

export const api = {
  get: <T>(endpoint: string, options?: ApiRequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),

  put: <T>(endpoint: string, body?: any, options?: ApiRequestOptions) =>
    apiClient<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(endpoint: string, options?: ApiRequestOptions) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
};

// Bind convenience methods to apiClient function as well
apiClient.get = api.get;
apiClient.post = api.post;
apiClient.put = api.put;
apiClient.delete = api.delete;

