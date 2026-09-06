/**
 * Plane API Error Classes
 * 
 * Provides a hierarchy of errors for different failure modes.
 */

export class PlaneError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'PlaneError';
  }
}

export class PlaneAuthenticationError extends PlaneError {
  constructor(message: string = 'Authentication failed', details?: any) {
    super(message, 'PLANE_AUTH_ERROR', 401, details);
    this.name = 'PlaneAuthenticationError';
  }
}

export class PlaneAuthorizationError extends PlaneError {
  constructor(message: string = 'Access denied', details?: any) {
    super(message, 'PLANE_AUTHZ_ERROR', 403, details);
    this.name = 'PlaneAuthorizationError';
  }
}

export class PlaneNotFoundError extends PlaneError {
  constructor(resource: string, identifier: string, details?: any) {
    super(`${resource} not found: ${identifier}`, 'PLANE_NOT_FOUND', 404, details);
    this.name = 'PlaneNotFoundError';
  }
}

export class PlaneValidationError extends PlaneError {
  constructor(message: string, details?: any) {
    super(message, 'PLANE_VALIDATION_ERROR', 400, details);
    this.name = 'PlaneValidationError';
  }
}

export class PlaneRateLimitError extends PlaneError {
  constructor(retryAfter?: number, details?: any) {
    super('Rate limit exceeded', 'PLANE_RATE_LIMIT', 429, { retryAfter, ...details });
    this.name = 'PlaneRateLimitError';
  }
}

export class PlaneServerError extends PlaneError {
  constructor(message: string = 'Internal server error', details?: any) {
    super(message, 'PLANE_SERVER_ERROR', 500, details);
    this.name = 'PlaneServerError';
  }
}

export class PlaneNetworkError extends PlaneError {
  constructor(message: string = 'Network error', details?: any) {
    super(message, 'PLANE_NETWORK_ERROR', undefined, details);
    this.name = 'PlaneNetworkError';
  }
}

export class PlaneTimeoutError extends PlaneError {
  constructor(message: string = 'Request timeout', details?: any) {
    super(message, 'PLANE_TIMEOUT', undefined, details);
    this.name = 'PlaneTimeoutError';
  }
}

/**
 * Maps HTTP status codes to appropriate error types
 */
export const createPlaneError = (response: Response, body?: any): PlaneError => {
  const { status, statusText } = response;
  const message = body?.error || body?.message || statusText;

  switch (status) {
    case 401:
      return new PlaneAuthenticationError(message, body);
    case 403:
      return new PlaneAuthorizationError(message, body);
    case 404:
      return new PlaneNotFoundError('Resource', 'unknown', body);
    case 400:
      return new PlaneValidationError(message, body);
    case 429:
      return new PlaneRateLimitError(body?.retry_after, body);
    case 500:
    case 502:
    case 503:
    case 504:
      return new PlaneServerError(message, body);
    default:
      return new PlaneError(message, 'PLANE_UNKNOWN', status, body);
  }
};