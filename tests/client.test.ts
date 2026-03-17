import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BizzaboClient, isApiError } from '../src/client.js';
import eventsFixtures from './fixtures/events.json';
import errorFixtures from './fixtures/error-responses.json';

// Helper to build a mock Response
function mockResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: new Headers(headers),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe('BizzaboClient', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. Constructor throws if no API key ───
  it('throws if no API key is provided', () => {
    expect(() => new BizzaboClient('')).toThrow();
    expect(() => new BizzaboClient(undefined as unknown as string)).toThrow();
  });

  // ─── 2. get() sends Authorization Bearer header ───
  it('sends Authorization Bearer header', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, eventsFixtures.singlePage));

    const client = new BizzaboClient('test-api-key');
    await client.get('/events');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer test-api-key');
  });

  // ─── 3. get() builds URL with base path and query params ───
  it('builds URL with base path and query params', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, eventsFixtures.singlePage));

    const client = new BizzaboClient('test-api-key');
    await client.get('/events', { page: '0', size: '100' });

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.bizzabo.com/v1/events?page=0&size=100');
  });

  // ─── 4. get() returns structured error on 401 ───
  it('returns structured error on 401 (auth_failed)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(errorFixtures.unauthorized.status, errorFixtures.unauthorized.body)
    );

    const client = new BizzaboClient('bad-key');
    const result = await client.get('/events');

    expect(isApiError(result)).toBe(true);
    if (isApiError(result)) {
      expect(result.error).toBe('auth_failed');
      expect(result.message).toContain('Invalid API key');
    }
  });

  // ─── 5. get() returns structured error on 404 ───
  it('returns structured error on 404 (not_found)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(errorFixtures.notFound.status, errorFixtures.notFound.body)
    );

    const client = new BizzaboClient('test-api-key');
    const result = await client.get('/events/999999');

    expect(isApiError(result)).toBe(true);
    if (isApiError(result)) {
      expect(result.error).toBe('not_found');
      expect(result.message).toContain('Event not found');
    }
  });

  // ─── 6. get() returns structured error on 500 ───
  it('returns structured error on 500 (server_error)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse(errorFixtures.serverError.status, errorFixtures.serverError.body)
    );

    const client = new BizzaboClient('test-api-key');
    const result = await client.get('/events');

    expect(isApiError(result)).toBe(true);
    if (isApiError(result)) {
      expect(result.error).toBe('server_error');
    }
  });

  // ─── 7. get() caching - returns cached result for identical requests ───
  it('returns cached result for identical requests within TTL', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(200, eventsFixtures.singlePage));

    const client = new BizzaboClient('test-api-key');
    const result1 = await client.get('/events');
    const result2 = await client.get('/events');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(result1).toEqual(result2);
  });

  // ─── 8. get() caching - does not cache different paths ───
  it('does not cache different paths', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(200, eventsFixtures.singlePage))
      .mockResolvedValueOnce(mockResponse(200, { content: [], page: { number: 0, size: 100, totalElements: 0, totalPages: 0 } }));

    const client = new BizzaboClient('test-api-key');
    await client.get('/events');
    await client.get('/sessions');

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // ─── 9. getAll() fetches all pages and combines results ───
  it('getAll fetches all pages and combines results', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(200, eventsFixtures.multiPage1))
      .mockResolvedValueOnce(mockResponse(200, eventsFixtures.multiPage2))
      .mockResolvedValueOnce(mockResponse(200, eventsFixtures.multiPage3));

    const client = new BizzaboClient('test-api-key');
    const result = await client.getAll('/events');

    expect(result.items).toHaveLength(3);
    expect(result.items[0].id).toBe(200001);
    expect(result.items[1].id).toBe(200002);
    expect(result.items[2].id).toBe(200003);
    expect(result.truncated).toBe(false);
    expect(result.totalElements).toBe(3);
  });

  // ─── 10. getAll() stops at maxPages and returns truncated flag ───
  it('getAll stops at maxPages and returns truncated flag', async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse(200, eventsFixtures.multiPage1))
      .mockResolvedValueOnce(mockResponse(200, eventsFixtures.multiPage2));

    const client = new BizzaboClient('test-api-key');
    const result = await client.getAll('/events', {}, 2);

    expect(result.items).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.totalElements).toBe(3);
  });

  // ─── 11. getAll() retries on 429 with backoff ───
  it('getAll retries on 429 with backoff', async () => {
    vi.useFakeTimers();

    // First page succeeds, second page 429 once then succeeds, third page succeeds
    mockFetch
      .mockResolvedValueOnce(mockResponse(200, eventsFixtures.multiPage1))
      .mockResolvedValueOnce(
        mockResponse(429, errorFixtures.rateLimited.body, { 'Retry-After': '1' })
      )
      .mockResolvedValueOnce(mockResponse(200, eventsFixtures.multiPage2))
      .mockResolvedValueOnce(mockResponse(200, eventsFixtures.multiPage3));

    const client = new BizzaboClient('test-api-key');
    const promise = client.getAll('/events');

    // Advance timers to cover all delays (inter-page delays + retry backoff)
    // Run through all pending timers until the promise resolves
    while (mockFetch.mock.calls.length < 4) {
      await vi.advanceTimersByTimeAsync(5000);
    }
    // One more advance to let remaining inter-page delays complete
    await vi.advanceTimersByTimeAsync(5000);

    const result = await promise;

    expect(result.items).toHaveLength(3);
    expect(result.truncated).toBe(false);
    expect(mockFetch).toHaveBeenCalledTimes(4); // 3 pages + 1 retry

    vi.useRealTimers();
  });

  // ─── 12. getAll() throws after exhausting retries on persistent 429 ───
  it('getAll throws after exhausting retries on persistent 429', async () => {
    vi.useFakeTimers();

    // First page succeeds, then persistent 429s
    mockFetch
      .mockResolvedValueOnce(mockResponse(200, eventsFixtures.multiPage1))
      .mockResolvedValue(
        mockResponse(429, errorFixtures.rateLimited.body, { 'Retry-After': '1' })
      );

    const client = new BizzaboClient('test-api-key');
    const promise = client.getAll('/events');

    // Advance timers enough for initial attempt + 2 retries + inter-page delays
    for (let i = 0; i < 10; i++) {
      await vi.advanceTimersByTimeAsync(5000);
    }

    await expect(promise).rejects.toThrow();

    vi.useRealTimers();
  });
});
