/**
 * Pagination utilities for Plane API
 * 
 * Handles cursor-based and offset-based pagination patterns.
 */

export interface PaginationParams {
  /** Cursor for cursor-based pagination */
  cursor?: string;
  /** Page number for offset-based pagination */
  page?: number;
  /** Items per page */
  perPage?: number;
}

export interface PaginatedResponse<T> {
  /** Array of items for the current page */
  items: T[];
  /** Next cursor (if available) */
  nextCursor?: string;
  /** Previous cursor (if available) */
  prevCursor?: string;
  /** Current page number */
  page?: number;
  /** Total items (if available) */
  total?: number;
  /** Total pages (if available) */
  totalPages?: number;
  /** Whether there are more items */
  hasMore: boolean;
}

export interface PlanePaginationConfig {
  /** Key for next cursor in response */
  nextCursorKey?: string;
  /** Key for previous cursor in response */
  prevCursorKey?: string;
  /** Key for items array in response */
  itemsKey?: string;
  /** Default items per page */
  defaultPerPage?: number;
  /** Maximum items per page */
  maxPerPage?: number;
}

const DEFAULT_CONFIG: Required<PlanePaginationConfig> = {
  nextCursorKey: 'next_cursor',
  prevCursorKey: 'prev_cursor',
  itemsKey: 'results',
  defaultPerPage: 20,
  maxPerPage: 100,
};

export const buildPaginationParams = (
  params: PaginationParams,
  config: PlanePaginationConfig = {}
): Record<string, any> => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const result: Record<string, any> = {};

  if (params.cursor) {
    result.cursor = params.cursor;
  }

  if (params.page !== undefined) {
    result.page = params.page;
  }

  const perPage = Math.min(
    params.perPage ?? cfg.defaultPerPage,
    cfg.maxPerPage
  );
  result.per_page = perPage;

  return result;
};

export const parsePaginatedResponse = <T>(
  response: any,
  config: PlanePaginationConfig = {}
): PaginatedResponse<T> => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  const items = response[cfg.itemsKey] ?? response.results ?? [];
  const nextCursor = response[cfg.nextCursorKey];
  const prevCursor = response[cfg.prevCursorKey];

  return {
    items,
    nextCursor: nextCursor ?? undefined,
    prevCursor: prevCursor ?? undefined,
    page: response.page ?? response.page_number,
    total: response.total ?? response.count,
    totalPages: response.total_pages,
    hasMore: Boolean(nextCursor),
  };
};

export class Paginator<T> implements AsyncIterable<T> {
  private client: any;
  private endpoint: string;
  private options: any;
  private config: PlanePaginationConfig;
  private limit?: number;
  private fetched = 0;

  constructor(
    client: any,
    endpoint: string,
    options: any,
    config: PlanePaginationConfig = {},
    limit?: number
  ) {
    this.client = client;
    this.endpoint = endpoint;
    this.options = options;
    this.config = config;
    this.limit = limit;
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let cursor: string | undefined;

    while (true) {
      if (this.limit && this.fetched >= this.limit) {
        break;
      }

      const response = await this.client.request(this.endpoint, {
        ...this.options,
        params: {
          ...this.options.params,
          cursor,
        },
      });

      const parsed = parsePaginatedResponse<T>(response, this.config);
      
      for (const item of parsed.items) {
        if (this.limit && this.fetched >= this.limit) {
          return;
        }
        yield item;
        this.fetched++;
      }

      if (!parsed.hasMore || !parsed.nextCursor) {
        break;
      }

      cursor = parsed.nextCursor;
    }
  }

  async toArray(): Promise<T[]> {
    const results: T[] = [];
    for await (const item of this) {
      results.push(item);
    }
    return results;
  }
}