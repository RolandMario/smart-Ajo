import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "ajo_access_token";

/**
 * In-memory cache mirroring SecureStore so the rest of the app (the
 * authedFetch wrapper, navigation guards) can read the current token
 * synchronously without awaiting a native bridge call on every request.
 * SecureStore remains the source of truth — this cache is populated on
 * app launch (see AuthContext) and kept in sync by every write here.
 */
let cachedToken: string | null = null;
let isHydrated = false;

export async function hydrateToken(): Promise<string | null> {
  if (isHydrated) return cachedToken;

  try {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    // SecureStore can throw on some Android devices/emulators without a
    // configured keystore. Treat as "no token" rather than crashing the
    // app on launch — the user just lands on the sign-in screen.
    cachedToken = null;
  }

  isHydrated = true;
  return cachedToken;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

/**
 * Synchronous read of the cached token. Returns null before
 * `hydrateToken()` has resolved at least once — callers that need the
 * token before hydration completes should await `hydrateToken()`
 * directly instead.
 */
export function getCachedToken(): string | null {
  return cachedToken;
}
