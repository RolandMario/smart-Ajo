import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { AppState } from "react-native";
import { hydrateToken, setToken, clearToken } from "./token-storage";
import {
  SESSION_IDLE_TIMEOUT_MS,
  clearSessionBackgrounded,
  clearSessionIdleState,
  markSessionBackgrounded,
  markSessionSeen,
  sessionBackgroundedElapsed,
  sessionLastSeenElapsed,
} from "./session-idle";
import {
  fetchCurrentUser,
  verifyOtp as verifyOtpRequest,
  requestOtp as requestOtpApi,
  registerNewUser as registerNewUserApi,
  loginWithPassword as loginWithPasswordApi,
  forgotPassword as forgotPasswordApi,
  resetPassword as resetPasswordApi,
} from "../api/auth";
import { ApiError } from "../api/api-error";
import type { AuthUser } from "../types/api";

type AuthStatus = "loading" | "signedOut" | "signedIn";

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  registerNewUser: (phone: string, email: string, password: string) => Promise<void>;
  loginWithPassword: (phone: string, password: string) => Promise<void>;
  forgotPassword: (phone: string) => Promise<void>;
  resetPassword: (phone: string, code: string, newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Re-fetches /auth/me — call after a profile update so the cached user reflects it. */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<AuthUser | null>(null);

  // On launch: hydrate the token from SecureStore, then validate it
  // against the backend by fetching /auth/me. A token can be present
  // but stale (revoked, expired, or the user was deactivated) — only a
  // successful /auth/me call counts as "signed in".
  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      // Auto-logout: if the app was closed/minimized for more than 3 minutes,
      // drop the stored token rather than silently restoring the session.
      const backgroundedElapsed = await sessionBackgroundedElapsed();
      const lastSeenElapsed = await sessionLastSeenElapsed();
      const timedOut =
        backgroundedElapsed !== null
          ? backgroundedElapsed > SESSION_IDLE_TIMEOUT_MS
          : lastSeenElapsed !== null &&
            lastSeenElapsed > SESSION_IDLE_TIMEOUT_MS;

      if (timedOut) {
        await clearToken();
        await clearSessionIdleState();
        if (!cancelled) setStatus("signedOut");
        return;
      }

      await markSessionSeen();
      const token = await hydrateToken();

      if (!token) {
        if (!cancelled) setStatus("signedOut");
        return;
      }

      try {
        const me = await fetchCurrentUser();
        if (!cancelled) {
          setUser(me);
          setStatus("signedIn");
        }
      } catch {
        // Token didn't validate — clear it and treat as signed out
        // rather than leaving the app in a broken half-authenticated
        // state.
        await clearToken();
        if (!cancelled) setStatus("signedOut");
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    await requestOtpApi(phone);
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    const result = await verifyOtpRequest(phone, code);
    await setToken(result.accessToken);
    setUser(result.user);
    setStatus("signedIn");
  }, []);

  const registerNewUser = useCallback(async (phone: string, email: string, password: string) => {
    await registerNewUserApi(phone, email, password);
  }, []);

  const loginWithPassword = useCallback(async (phone: string, password: string) => {
    const result = await loginWithPasswordApi(phone, password);
    await setToken(result.accessToken);
    setUser(result.user);
    setStatus("signedIn");
  }, []);

  const forgotPassword = useCallback(async (phone: string) => {
    await forgotPasswordApi(phone);
  }, []);

  const resetPassword = useCallback(async (phone: string, code: string, newPassword: string) => {
    await resetPasswordApi(phone, code, newPassword);
  }, []);

  const signOut = useCallback(async () => {
    await clearToken();
    await clearSessionIdleState();
    setUser(null);
    setStatus("signedOut");
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const me = await fetchCurrentUser();
      setUser(me);
    } catch (error) {
      // If the token has been invalidated server-side (deactivated
      // account, etc.), treat exactly like any other 401 — sign out
      // rather than silently keeping stale user data.
      if (error instanceof ApiError && error.isUnauthorized) {
        await signOut();
      }
    }
  }, [signOut]);

  // Auto-logout when the user closes/minimizes the app for more than 3
  // minutes. Normal "minimize" is caught here (app goes to background); a
  // cold relaunch is handled by the bootstrap check using the persisted
  // timestamps.
  useEffect(() => {
    let active = true;

    async function handleForeground() {
      const bgElapsed = await sessionBackgroundedElapsed();
      if (bgElapsed !== null && bgElapsed > SESSION_IDLE_TIMEOUT_MS) {
        if (active) void signOut();
        return;
      }
      await clearSessionBackgrounded();
      await markSessionSeen();
    }

    const listener = (next: string) => {
      if (next === "background" || next === "inactive") {
        void markSessionBackgrounded();
      } else if (next === "active") {
        void handleForeground();
      }
    };

    const subscription = AppState.addEventListener("change", listener);

    return () => {
      active = false;
      subscription.remove();
    };
  }, [signOut]);

  const value = useMemo(
    () => ({ status, user, requestOtp, verifyOtp, registerNewUser, loginWithPassword, forgotPassword, resetPassword, signOut, refreshUser }),
    [status, user, requestOtp, verifyOtp, registerNewUser, loginWithPassword, forgotPassword, resetPassword, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}