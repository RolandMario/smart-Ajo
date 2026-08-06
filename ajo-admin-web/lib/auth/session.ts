import "server-only";
import { cookies } from "next/headers";
import { decodeJwt } from "jose";
import type { AdminUser, Role } from "@/lib/types/api";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "ajo_admin_session";

interface JwtPayload {
  sub: string;
  role: Role;
  phone: string;
  email?: string;
  exp?: number;
}

/**
 * Stores the admin's access token in an httpOnly, secure cookie.
 * The token never reaches client-side JS — every authenticated request
 * is made from a Server Component / Server Action / Route Handler that
 * reads this cookie and attaches it as a Bearer header (see
 * lib/api/client.ts).
 *
 * Expiry mirrors the JWT's own `exp` claim so the cookie doesn't outlive
 * a token ajo-server would reject anyway.
 */
export async function createSession(accessToken: string): Promise<void> {
  const payload = decodeJwt(accessToken) as JwtPayload;
  const expiresAt = payload.exp ? new Date(payload.exp * 1000) : undefined;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getAccessToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value;
}

/**
 * Decodes the current session's JWT into a lightweight user object,
 * WITHOUT verifying the signature — verification happens server-side on
 * ajo-server for every actual API call. This is only used here to read
 * non-sensitive display data (name/phone/role) for the UI shell, and to
 * let middleware redirect unauthenticated visitors quickly.
 */
export async function getSessionUser(): Promise<AdminUser | null> {
  const token = await getAccessToken();
  if (!token) return null;

  try {
    const payload = decodeJwt(token) as JwtPayload;

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null;
    }

    return {
      id: payload.sub,
      phone: payload.phone,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}
