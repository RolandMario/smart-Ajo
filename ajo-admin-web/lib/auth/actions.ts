"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/api-error";
import { createSession, destroySession } from "@/lib/auth/session";
import type { LoginResponse } from "@/lib/types/api";

export interface LoginActionResult {
  error?: string;
}

/**
 * Server Action backing the login form. ajo-server's
 * POST /auth/admin/login only succeeds for role: platform_admin users
 * (enforced server-side) — the form itself doesn't need to know that.
 */
export async function loginAction(
  _prevState: LoginActionResult,
  formData: FormData,
): Promise<LoginActionResult> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return { error: "Enter your email and password." };
  }

  try {
    const result = await apiFetch<LoginResponse>("/auth/admin/login", {
      method: "POST",
      body: { email, password },
    });

    await createSession(result.accessToken);
  } catch (error) {
    if (error instanceof ApiError) {
      // ajo-server returns 401 for both "no such admin" and "wrong
      // password" — intentionally vague, so we mirror that here rather
      // than leaking which one it was.
      return { error: "Incorrect email or password." };
    }

    return { error: "Couldn't reach the server. Check your connection and try again." };
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}
