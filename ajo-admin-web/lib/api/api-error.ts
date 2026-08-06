import type { ApiErrorBody } from "@/lib/types/api";

/**
 * Thrown by `apiFetch` whenever ajo-server responds with a non-2xx
 * status. Carries the parsed error body so callers can show the
 * backend's actual validation message rather than a generic "failed".
 */
export class ApiError extends Error {
  readonly statusCode: number;
  readonly body?: ApiErrorBody;

  constructor(statusCode: number, body?: ApiErrorBody) {
    const message = ApiError.extractMessage(body) ?? `Request failed (${statusCode})`;
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
}
