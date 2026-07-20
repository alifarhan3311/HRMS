/**
 * utils/axios.js
 * -----------------------------------------------------------------------
 * Centralized Axios instance for all client-side API calls.
 *
 * Auth model: the access/refresh tokens live in HttpOnly cookies set by
 * the server, so this file never reads or stores a token in JS-accessible
 * memory/localStorage (that would be an XSS-exfiltration risk). Instead:
 *
 *  - withCredentials: true  -> cookies are sent automatically on every
 *    request to the API origin.
 *  - On a 401 with code ACCESS_TOKEN_EXPIRED, we call the refresh endpoint
 *    once, then transparently retry the original request. Concurrent
 *    requests that 401 at the same time all queue behind a single
 *    in-flight refresh call instead of each firing their own refresh.
 * -----------------------------------------------------------------------
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // send/receive HttpOnly cookies cross-origin
  // Cloud proxy hops and a sleeping database cluster can
  // take 30+ seconds on the first request. Keep the client alive long enough
  // to receive the real API response instead of reporting a false network
  // failure during a cold start.
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// -------------------------------------------------------------------------
// Refresh-queue state. Prevents a "thundering herd" of refresh calls when
// several requests fail with an expired token in the same tick.
// -------------------------------------------------------------------------
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeToRefresh(callback) {
  refreshSubscribers.push(callback);
}

function notifyRefreshSubscribers() {
  refreshSubscribers.forEach((callback) => callback());
  refreshSubscribers = [];
}

/**
 * Normalizes every error thrown by the API into a consistent shape so
 * UI code never has to branch on axios's own error structure.
 */
function parseApiError(error) {
  if (error.response) {
    const { status, data } = error.response;
    return {
      status,
      message: data?.error?.message || 'An unexpected error occurred.',
      code: data?.error?.code,
    };
  }
  if (error.code === 'ECONNABORTED') {
    return { status: 0, message: 'The server took too long to respond. Please try again.' };
  }
  if (error.request) {
    return { status: 0, message: 'Unable to reach the server. Please check your connection.' };
  }
  return { status: -1, message: error.message || 'Unexpected client error.' };
}

// -------------------------------------------------------------------------
// Request interceptor — reserved for attaching request-scoped metadata
// (e.g. a correlation ID for tracing), and skipping the refresh dance on
// requests that don't need auth at all.
// -------------------------------------------------------------------------
axiosInstance.interceptors.request.use(
  (config) => {
    config.headers['X-Request-Id'] =
      config.headers['X-Request-Id'] || crypto.randomUUID?.() || `${Date.now()}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// -------------------------------------------------------------------------
// Response interceptor — handles silent refresh-and-retry, otherwise
// normalizes the error shape for downstream RTK Query / component code.
// -------------------------------------------------------------------------
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    const isExpiredAccessToken = status === 401 && code === 'ACCESS_TOKEN_EXPIRED';
    const isRefreshCallItself = originalRequest?.url?.includes('/auth/refresh');
    const alreadyRetried = originalRequest?._retry;

    if (isExpiredAccessToken && !isRefreshCallItself && !alreadyRetried) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Another request already triggered a refresh — wait for it, then
        // retry this request once the new cookie is set.
        return new Promise((resolve) => {
          subscribeToRefresh(() => resolve(axiosInstance(originalRequest)));
        });
      }

      isRefreshing = true;

      try {
        await axiosInstance.post('/auth/refresh'); // server rotates the HttpOnly cookies
        isRefreshing = false;
        notifyRefreshSubscribers();
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        refreshSubscribers = [];
        // Refresh token itself is invalid/expired — force a full logout.
        window.dispatchEvent(new CustomEvent('auth:session-expired'));
        return Promise.reject(parseApiError(refreshError));
      }
    }

    return Promise.reject(parseApiError(error));
  }
);

export default axiosInstance;
export { parseApiError };
