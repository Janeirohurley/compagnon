export interface PlaneClientConfig {
  /** Base URL for the Plane API */
  baseUrl: string;
  /** Optional API key (should be treated as secret) */
  apiKey?: string;
  /** Timeout for HTTP requests in ms */
  timeout?: number;
  /** Whether to enable retries */
  retryEnabled?: boolean;
  /** Max retries for failed requests */
  maxRetries?: number;
}

export interface PlaneRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: any;
  params?: Record<string, any>;
  headers?: Record<string, string>;
}

export interface PlaneClient {
  /** Make HTTP requests to the Plane API */
  request: <T = any>(endpoint: string, options?: PlaneRequestOptions) => Promise<T>;
}

export class PlaneHttpClient implements PlaneClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly retryEnabled: boolean;
  private readonly maxRetries: number;

  constructor(config: PlaneClientConfig) {
    this.baseUrl = this.normalizeBaseUrl(config.baseUrl);
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000;
    this.retryEnabled = config.retryEnabled ?? true;
    this.maxRetries = config.maxRetries ?? 3;
  }

  private normalizeBaseUrl(baseUrl: string): string {
    const normalized = baseUrl.trim().replace(/\/$/, '');
    const apiRoot = '/api/v1';
    const apiIndex = normalized.toLowerCase().indexOf(apiRoot);

    if (apiIndex !== -1) {
      return normalized.slice(0, apiIndex + apiRoot.length);
    }

    return normalized;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildUrl(endpoint: string, params?: Record<string, any>): string {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }
    return url.toString();
  }

  private async executeRequest<T>(endpoint: string, options: PlaneRequestOptions = {}): Promise<T> {
    const { method = 'GET', body, params, headers = {} } = options;
    const url = this.buildUrl(endpoint, params);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(this.apiKey ? { 'X-API-Key': this.apiKey } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Plane API error: ${response.status} ${response.statusText}`);
      }

      return response.json() as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async request<T = any>(endpoint: string, options?: PlaneRequestOptions): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.executeRequest<T>(endpoint, options);
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.maxRetries && this.retryEnabled) {
          await this.sleep(Math.min(1000 * Math.pow(2, attempt), 10000));
        }
      }
    }

    throw lastError;
  }
}

export const createPlaneClient = (config: PlaneClientConfig): PlaneClient => {
  return new PlaneHttpClient(config);
};

export const PlaneClient = createPlaneClient;
