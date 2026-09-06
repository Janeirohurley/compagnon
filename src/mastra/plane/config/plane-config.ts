/**
 * Plane Configuration
 * 
 * Manages Plane API configuration and connection settings.
 */

import { createPlaneClient, PlaneClient, PlaneClientConfig } from '../client/plane-client';

export interface PlaneConnectionConfig {
  /** Base URL for the Plane API */
  baseUrl: string;
  /** API Key (secret - never log or expose) */
  apiKey?: string;
  /** Workspace slug */
  workspaceSlug?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Enable retries */
  retryEnabled?: boolean;
  /** Max retries */
  maxRetries?: number;
}

export interface PlaneConfigOptions {
  /** Environment variable prefix for config keys */
  envPrefix?: string;
  /** Default timeout */
  defaultTimeout?: number;
}

const DEFAULT_OPTIONS: Required<PlaneConfigOptions> = {
  envPrefix: 'PLANE',
  defaultTimeout: 30000,
};

/**
 * Environment variable mapping for Plane configuration
 */
export const PLANE_ENV_KEYS = {
  BASE_URL: 'PLANE_BASE_URL',
  API_KEY: 'PLANE_API_KEY',
  WORKSPACE_SLUG: 'PLANE_WORKSPACE_SLUG',
  TIMEOUT: 'PLANE_TIMEOUT',
  RETRY_ENABLED: 'PLANE_RETRY_ENABLED',
} as const;

/**
 * Get configuration from environment variables
 */
export const getPlaneConfigFromEnv = (options: PlaneConfigOptions = {}): PlaneConnectionConfig => {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const prefix = opts.envPrefix;

  const baseUrl = process.env[`${prefix}_BASE_URL`] || 'https://api.plane.so/api/v1';
  const apiKey = process.env[`${prefix}_API_KEY`];

  return {
    baseUrl,
    apiKey,
    workspaceSlug: process.env[`${prefix}_WORKSPACE_SLUG`],
    timeout: process.env[`${prefix}_TIMEOUT`]
      ? parseInt(process.env[`${prefix}_TIMEOUT`]!, 10)
      : opts.defaultTimeout,
    retryEnabled: process.env[`${prefix}_RETRY_ENABLED`] !== 'false',
    maxRetries: 3,
  };
};

/**
 * Plane configuration manager
 */
export class PlaneConfig {
  private client: PlaneClient | null = null;
  private config: PlaneConnectionConfig;

  constructor(config: PlaneConnectionConfig) {
    this.config = {
      ...config,
      timeout: config.timeout ?? DEFAULT_OPTIONS.defaultTimeout,
      retryEnabled: config.retryEnabled ?? true,
      maxRetries: config.maxRetries ?? 3,
    };
  }

  /**
   * Get or create the Plane HTTP client
   */
  getClient(): PlaneClient {
    if (!this.client) {
      const clientConfig: PlaneClientConfig = {
        baseUrl: this.config.baseUrl,
        apiKey: this.config.apiKey,
        timeout: this.config.timeout,
        retryEnabled: this.config.retryEnabled,
        maxRetries: this.config.maxRetries,
      };
      this.client = createPlaneClient(clientConfig);
    }
    return this.client;
  }

  /**
   * Get the configured workspace slug
   */
  getWorkspaceSlug(): string | undefined {
    return this.config.workspaceSlug;
  }

  /**
   * Check if the configuration has an API key
   */
  hasApiKey(): boolean {
    return Boolean(this.config.apiKey);
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }
}

/**
 * Create a PlaneConfig instance from environment variables
 */
export const createPlaneConfig = (options?: PlaneConfigOptions): PlaneConfig => {
  const config = getPlaneConfigFromEnv(options);
  return new PlaneConfig(config);
};

/**
 * Singleton instance for the application
 */
let globalPlaneConfig: PlaneConfig | null = null;

export const getPlaneConfig = (): PlaneConfig | null => globalPlaneConfig;

export const initializePlaneConfig = (options?: PlaneConfigOptions): PlaneConfig => {
  globalPlaneConfig = createPlaneConfig(options);
  return globalPlaneConfig;
};