import "server-only";
import { ApiError } from "./api-error";
import type { ApiErrorBody } from "@/lib/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Bearer token for authenticated requests. Omit for public endpoints (e.g. login). */
  accessToken?: string;
  /** Disable Next.js's fetch cache — use for anything that must always be fresh. */
  noStore?: boolean;
}

/**
 * Thin, typed wrapper around fetch for talking to ajo-server. Always
 * called from the server (Server Components / Server Actions / Route
 * Handlers) — the admin's JWT never reaches the browser, it's read from
 * an httpOnly cookie and attached here. See lib/auth/session.ts.
 */
export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { method = "GET", body, accessToken, noStore = true } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: noStore ? "no-store" : undefined,
  });

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
