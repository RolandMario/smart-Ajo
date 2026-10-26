import type { ApiErrorBody } from "../types/api";

/**
 * Thrown by `apiFetch` whenever ajo-server responds with a non-2xx
 * status. Carries the parsed error body so callers can show the
 * backend's actual validation message rather than a generic failure.
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly body?: ApiErrorBody;

  constructor(statusCode: number, body?: ApiErrorBody) {
    // statusCode 0 is apiFetch's normalization of a request that never got a
    // response (server down / wrong host / no connectivity). "Request failed
    // (0)" is meaningless to a user, so it gets its own actionable message.
    const message =
      statusCode === 0
        ? "Can't reach the server. Check your internet connection and try again."
        : (ApiError.extractMessage(body) ?? `Request failed (${statusCode})`);
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.body = body;
  }

  private static extractMessage(body?: ApiErrorBody): string | undefined {
    if (!body) return undefined;
    return Array.isArray(body.message) ? body.message.join(", ") : body.message;
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  get isNetworkError(): boolean {
    return this.statusCode === 0;
  }
}
