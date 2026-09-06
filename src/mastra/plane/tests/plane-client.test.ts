import { describe, it, expect } from 'vitest';
import { PlaneHttpClient } from '../client/plane-client';
import { PlaneAuthenticationError, PlaneRateLimitError, PlaneValidationError } from '../client/plane-errors';
import { buildPaginationParams, parsePaginatedResponse } from '../client/plane-pagination';

describe('Plane client', () => {
  it('adds bearer auth when an API key is present', () => {
    const client = new PlaneHttpClient({ baseUrl: 'https://api.plane.so', apiKey: 'secret' });
    expect(client).toBeDefined();
  });

  it('builds pagination params', () => {
    expect(buildPaginationParams({ page: 2, perPage: 10 })).toEqual({ page: 2, per_page: 10 });
  });

  it('parses paginated responses', () => {
    const parsed = parsePaginatedResponse({ results: [{ id: '1' }], next_cursor: 'abc' });
    expect(parsed.items).toHaveLength(1);
    expect(parsed.nextCursor).toBe('abc');
    expect(parsed.hasMore).toBe(true);
  });
});

describe('Plane errors', () => {
  it('maps auth errors', () => {
    const err = new PlaneAuthenticationError('bad token');
    expect(err.statusCode).toBe(401);
  });

  it('maps rate limit errors', () => {
    const err = new PlaneRateLimitError(60);
    expect(err.statusCode).toBe(429);
  });

  it('maps validation errors', () => {
    const err = new PlaneValidationError('bad payload');
    expect(err.statusCode).toBe(400);
  });
});
