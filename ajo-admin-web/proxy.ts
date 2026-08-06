import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "ajo_admin_session";
const PUBLIC_PATHS = ["/login"];

/**
 * Lightweight gate: redirects to /login if there's no session cookie at
 * all. This is a fast, presence-only check — the proxy runs on the Edge
 * runtime where verifying the JWT signature isn't worth the complexity,
 * and it wouldn't change the outcome anyway, since every actual data
 * request still goes through `authedFetch`, which redirects to /login if
 * ajo-server rejects the token (expired/invalid/revoked). This just
 * avoids flashing a dashboard shell with no data before that redirect
 * kicks in.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  const hasSession = request.cookies.has(COOKIE_NAME);

  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
