import { apiFetch, type ApiFetchOptions } from "./client";
import { getCachedToken } from "../auth/token-storage";
import { ApiError } from "./api-error";

/**
 * Like apiFetch, but automatically attaches the current session token.
 * Throws ApiError(401-equivalent) if there's no token at all — callers
 * inside authenticated screens shouldn't normally hit this (navigation
 * guards keep unauthenticated users out), but it's a safe fallback if a
 * token is cleared mid-session (e.g. a concurrent logout).
 *
 * Unlike ajo-admin-web's authedFetch, this does NOT redirect on 401 —
 * there's no server-side redirect mechanism in React Native. Instead,
 * AuthContext listens for ApiError.isUnauthorized in its own request
 * wrapping and clears the session, which the navigator reacts to by
 * swapping to the auth stack. See AuthContext.tsx.
 */
export async function authedFetch<T>(
  path: string,
  options: Omit<ApiFetchOptions, "accessToken"> = {},
): Promise<T> {
  const accessToken = getCachedToken();

  if (!accessToken) {
    throw new ApiError(401, { statusCode: 401, message: "No active session" });
  }

  return apiFetch<T>(path, { ...options, accessToken });
}
