const BASE_URL = 'https://api.bizzabo.com/v1';
const AUTH_URL = 'https://auth.bizzabo.com/oauth/token';
const AUTH_AUDIENCE = 'https://api.bizzabo.com/api';
const CACHE_TTL_MS = 60_000; // 60 seconds
const TOKEN_REFRESH_MARGIN_MS = 300_000; // refresh 5 min before expiry
const DEBUG = process.env.DEBUG === '1';

// ─── Types ───────────────────────────────────────────────────────────

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
  accountId: number;
}

export interface PaginatedResponse<T = unknown> {
  content: T[];
  page: {
    number: number;
    size: number;
    totalElements: number;
    totalPages: number;
  };
}

export interface GetAllResult<T = unknown> {
  items: T[];
  totalElements: number;
  truncated: boolean;
}

export interface ApiError {
  error: string;
  message: string;
}

export type ApiResult<T = unknown> = T | ApiError;

// ─── Helpers ─────────────────────────────────────────────────────────

export function isApiError(result: unknown): result is ApiError {
  return (
    typeof result === 'object' &&
    result !== null &&
    'error' in result &&
    'message' in result &&
    !('content' in result)
  );
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debug(...args: unknown[]): void {
  if (DEBUG) {
    process.stderr.write(`[bizzabo] ${args.map(String).join(' ')}\n`);
  }
}

function mapStatusToError(status: number): string {
  if (status === 401) return 'auth_failed';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';
  return 'unknown_error';
}

// ─── Cache ───────────────────────────────────────────────────────────

interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
}

// ─── Client ──────────────────────────────────────────────────────────

export class BizzaboClient {
  private credentials: OAuthCredentials;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private cache = new Map<string, CacheEntry>();

  constructor(credentials: OAuthCredentials) {
    this.credentials = credentials;
  }

  /**
   * Get a valid access token, refreshing via OAuth2 client credentials if needed.
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt - TOKEN_REFRESH_MARGIN_MS) {
      return this.accessToken;
    }

    debug('fetching new OAuth2 token');

    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Bizzabo-MCP/1.0',
      },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.credentials.clientId,
        client_secret: this.credentials.clientSecret,
        account_id: this.credentials.accountId,
        audience: AUTH_AUDIENCE,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg = (body as Record<string, string>).message || response.statusText;
      throw new Error(`OAuth2 token request failed (${response.status}): ${msg}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };

    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;
    debug('got token, expires in', data.expires_in, 'seconds');

    return this.accessToken;
  }

  /**
   * Paginated GET — returns one page (or a structured ApiError).
   */
  async get<T = unknown>(
    path: string,
    params?: Record<string, string>
  ): Promise<ApiResult<PaginatedResponse<T>>> {
    const sortedParams = params
      ? Object.keys(params)
          .sort()
          .map((k) => `${k}=${params[k]}`)
          .join('&')
      : '';
    const cacheKey = `GET:${path}?${sortedParams}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      debug('cache hit', cacheKey);
      return cached.data as PaginatedResponse<T>;
    }

    const url = sortedParams
      ? `${BASE_URL}${path}?${sortedParams}`
      : `${BASE_URL}${path}`;

    debug('GET', url);

    const token = await this.getAccessToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorCode = mapStatusToError(response.status);
        const message =
          (body as Record<string, string>).message || response.statusText;
        debug('error', response.status, errorCode, message);
        return { error: errorCode, message } as ApiError;
      }

      const data = (await response.json()) as PaginatedResponse<T>;

      // Cache successful responses
      this.cache.set(cacheKey, {
        data,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Non-paginated GET for single resources (e.g., /events/123).
   */
  async getSingle<T = unknown>(path: string): Promise<ApiResult<T>> {
    const cacheKey = `GET:${path}?`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      debug('cache hit', cacheKey);
      return cached.data as T;
    }

    const url = `${BASE_URL}${path}`;
    debug('GET (single)', url);

    const token = await this.getAccessToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorCode = mapStatusToError(response.status);
        const message =
          (body as Record<string, string>).message || response.statusText;
        return { error: errorCode, message } as ApiError;
      }

      const data = (await response.json()) as T;

      this.cache.set(cacheKey, {
        data,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });

      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Auto-paginate through all pages, combining content arrays.
   * Retries on 429 with exponential backoff (max 2 retries per page).
   */
  async getAll<T = unknown>(
    path: string,
    params: Record<string, string> = {},
    maxPages = 10
  ): Promise<GetAllResult<T>> {
    const items: T[] = [];
    let totalElements = 0;
    let currentPage = 0;
    let totalPages = 1; // will be updated from first response
    const startTime = Date.now();
    const TOTAL_TIMEOUT_MS = 120_000; // 2 minutes

    while (currentPage < totalPages && currentPage < maxPages) {
      if (Date.now() - startTime > TOTAL_TIMEOUT_MS) {
        throw new Error('getAll() total timeout exceeded (2 minutes)');
      }

      // Inter-page delay (skip for first page)
      if (currentPage > 0) {
        await sleep(100);
      }

      const pageParams = { ...params, page: String(currentPage), size: params.size || '100' };
      const pageResult = await this.fetchPageWithRetry<T>(path, pageParams, 2);

      items.push(...pageResult.content);
      totalElements = pageResult.page.totalElements;
      totalPages = pageResult.page.totalPages;
      currentPage++;
    }

    const truncated = currentPage < totalPages;
    return { items, totalElements, truncated };
  }

  /**
   * Fetch a single page with retry logic for 429 responses.
   */
  private async fetchPageWithRetry<T>(
    path: string,
    params: Record<string, string>,
    maxRetries: number
  ): Promise<PaginatedResponse<T>> {
    let retries = 0;

    while (true) {
      const result = await this.fetchPageDirect<T>(path, params);

      if (!isApiError(result)) {
        return result;
      }

      if (result.error === 'rate_limited' && retries < maxRetries) {
        retries++;
        const backoffMs = 1000 * Math.pow(2, retries - 1); // 1s, 2s
        debug('429 retry', retries, 'backoff', backoffMs, 'ms');
        await sleep(backoffMs);
        continue;
      }

      throw new Error(`API error on ${path}: ${result.error} — ${result.message}`);
    }
  }

  /**
   * Direct fetch for a single page — bypasses cache (getAll manages its own flow).
   */
  private async fetchPageDirect<T>(
    path: string,
    params: Record<string, string>
  ): Promise<ApiResult<PaginatedResponse<T>>> {
    const sortedParams = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join('&');
    const url = `${BASE_URL}${path}?${sortedParams}`;

    debug('GET (page)', url);

    const token = await this.getAccessToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorCode = mapStatusToError(response.status);
        const message =
          (body as Record<string, string>).message || response.statusText;
        return { error: errorCode, message } as ApiError;
      }

      return (await response.json()) as PaginatedResponse<T>;
    } finally {
      clearTimeout(timeout);
    }
  }
}
