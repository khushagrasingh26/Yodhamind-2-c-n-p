/**
 * shared/auth-interceptor.js — Frontend Auth Token Manager
 * ═════════════════════════════════════════════════════════
 *
 * Wraps the native fetch() API to automatically:
 *   1. Attach the access token (Bearer header)
 *   2. On 401 → attempt token refresh via /api/auth/refresh
 *   3. Retry the original request with the new token
 *   4. On refresh failure → redirect to login
 *
 * Usage:
 *   <script src="/shared/auth-interceptor.js"></script>
 *   <script>
 *     // Use authFetch() instead of fetch() for authenticated requests
 *     const res = await authFetch('/api/mood', { method: 'POST', body: ... });
 *   </script>
 *
 * Storage keys:
 *   ym_access_token   — JWT access token (short-lived: 15 min)
 *   ym_refresh_token   — refresh token (long-lived: 30 days)
 *   ym_token_expires   — Unix timestamp when access token expires
 */

// eslint-disable-next-line no-unused-vars
const AuthInterceptor = (function () {
  'use strict';

  const STORAGE_KEYS = {
    accessToken:  'ym_access_token',
    refreshToken: 'ym_refresh_token',
    expiresAt:    'ym_token_expires'
  };

  const LOGIN_PATH   = '/login';
  const REFRESH_URL  = '/api/auth/refresh';

  // Buffer: refresh token 60 seconds before actual expiry
  const REFRESH_BUFFER_MS = 60 * 1000;

  let isRefreshing = false;
  let refreshPromise = null;

  /* ── Token Storage ───────────────────────── */

  function getAccessToken() {
    return localStorage.getItem(STORAGE_KEYS.accessToken);
  }

  function getRefreshToken() {
    return localStorage.getItem(STORAGE_KEYS.refreshToken);
  }

  function setTokens(accessToken, refreshToken, expiresIn) {
    localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
    localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
    localStorage.setItem(STORAGE_KEYS.expiresAt, String(Date.now() + expiresIn * 1000));
  }

  function clearTokens() {
    localStorage.removeItem(STORAGE_KEYS.accessToken);
    localStorage.removeItem(STORAGE_KEYS.refreshToken);
    localStorage.removeItem(STORAGE_KEYS.expiresAt);
  }

  function isTokenExpired() {
    const expiresAt = parseInt(localStorage.getItem(STORAGE_KEYS.expiresAt), 10);
    if (!expiresAt) return true;
    return Date.now() >= (expiresAt - REFRESH_BUFFER_MS);
  }

  /* ── Token Refresh ───────────────────────── */

  async function refreshTokens() {
    // Deduplicate concurrent refresh calls
    if (isRefreshing) {
      return refreshPromise;
    }

    const currentRefreshToken = getRefreshToken();
    if (!currentRefreshToken) {
      throw new Error('No refresh token available');
    }

    isRefreshing = true;
    refreshPromise = (async () => {
      try {
        const res = await fetch(REFRESH_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: currentRefreshToken })
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error?.code || 'REFRESH_FAILED');
        }

        const { data } = await res.json();
        setTokens(data.accessToken, data.refreshToken, data.expiresIn);
        return data.accessToken;

      } catch (err) {
        // Refresh failed — clear everything and redirect to login
        clearTokens();
        if (window.location.pathname !== LOGIN_PATH) {
          window.location.href = LOGIN_PATH;
        }
        throw err;

      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    })();

    return refreshPromise;
  }

  /* ── Authenticated Fetch ─────────────────── */

  async function authFetch(url, options = {}) {
    // Don't intercept auth endpoints themselves
    if (url.startsWith('/api/auth/login') ||
        url.startsWith('/api/auth/register') ||
        url.startsWith('/api/auth/refresh')) {
      return fetch(url, options);
    }

    // Proactively refresh if token is about to expire
    let token = getAccessToken();
    if (token && isTokenExpired()) {
      try {
        token = await refreshTokens();
      } catch {
        // Will redirect to login — return a mock response
        return new Response(JSON.stringify({ ok: false, error: { code: 'AUTH_REQUIRED' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Attach authorization header
    const headers = new Headers(options.headers || {});
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(url, { ...options, headers });

    // If 401 and we haven't tried refreshing yet, try once
    if (response.status === 401 && !isRefreshing) {
      try {
        const newToken = await refreshTokens();
        headers.set('Authorization', `Bearer ${newToken}`);
        return fetch(url, { ...options, headers });
      } catch {
        return response;
      }
    }

    return response;
  }

  /* ── Login Helper ────────────────────────── */

  async function login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const body = await res.json();

    if (body.ok && body.data?.tokens) {
      setTokens(
        body.data.tokens.accessToken,
        body.data.tokens.refreshToken,
        body.data.tokens.expiresIn
      );
    }

    return body;
  }

  /* ── Logout Helper ───────────────────────── */

  async function logout() {
    const refreshToken = getRefreshToken();
    const token = getAccessToken();

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ refreshToken })
      });
    } catch {
      // Ignore errors — we clear tokens regardless
    }

    clearTokens();
  }

  /* ── Public API ──────────────────────────── */

  return {
    authFetch,
    login,
    logout,
    setTokens,
    clearTokens,
    getAccessToken,
    isTokenExpired,
    STORAGE_KEYS
  };

})();

// Make authFetch globally available as a convenience
// eslint-disable-next-line no-unused-vars
const authFetch = AuthInterceptor.authFetch;
