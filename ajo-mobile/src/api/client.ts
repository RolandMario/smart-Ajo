import { ApiError } from "./api-error";
import type { ApiErrorBody } from "../types/api";

// Must be a literal `process.env.EXPO_PUBLIC_*` access (not destructured,
// not a dynamic key) for Expo's Metro config to statically inline it at
// build time. See https://docs.expo.dev/guides/environment-variables/
const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "EXPO_PUBLIC_API_BASE_URL is not set. Copy .env.example to .env and fill it in, then restart the dev server.",
  );
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Bearer token for authenticated requests. Omit for public endpoints (OTP request/verify). */
  accessToken?: string;
}

/**
 * Thin, typed wrapper around fetch for talking to ajo-server.
 *
 * Network failures (no connectivity, request timeout, DNS failure) are
 * normalized into an ApiError with statusCode 0 (see
 * ApiError.isNetworkError) rather than letting a raw TypeError escape —
 * callers can handle "couldn't reach the server" uniformly alongside
 * real HTTP error responses.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = "GET", body, accessToken } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;

  if (!response.ok) {
    throw new ApiError(response.status, data as ApiErrorBody | undefined);
  }

  return data as T;
}
