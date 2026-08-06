import "server-only";
import { redirect } from "next/navigation";
import { apiFetch, type ApiFetchOptions } from "./client";
import { getAccessToken } from "@/lib/auth/session";
import { ApiError } from "./api-error";

/**
 * Like apiFetch, but automatically attaches the current admin's session
 * token. Redirects to /login if there's no session, or if ajo-server
 * rejects the token (expired/revoked) — this keeps that check out of
 * every individual page.
 */
export async function authedFetch<T>(
  path: string,
  options: Omit<ApiFetchOptions, "accessToken"> = {},
): Promise<T> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    redirect("/login");
  }

  try {
    return await apiFetch<T>(path, { ...options, accessToken });
  } catch (error) {
    if (error instanceof ApiError && error.isUnauthorized) {
      redirect("/login");
    }
    throw error;
  }
}
