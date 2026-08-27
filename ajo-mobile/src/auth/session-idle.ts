import * as SecureStore from "expo-secure-store";

/**
 * Auto-logout idle tracking.
 *
 * We persist two timestamps in SecureStore so the 3-minute rule survives an
 * app restart:
 *
 *  - "backgrounded at" — written when the app leaves the foreground (user
 *    minimizes/app-switches). Used to auto-logout when the user returns after
 *    more than `SESSION_IDLE_TIMEOUT_MS`.
 *
 *  - "last seen" — written on launch (bootstrap) and when the app returns to
 *    the foreground. Used to auto-logout on a cold relaunch more than 3
 *    minutes after the app was closed.
 */

const BACKGROUNDED_KEY = "ajo_backgrounded_at";
const LAST_SEEN_KEY = "ajo_last_seen_at";

/** 3 minutes. */
export const SESSION_IDLE_TIMEOUT_MS = 3 * 60 * 1000;

const read = async (key: string): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
};

const write = async (key: string, value: string): Promise<void> => {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Best effort.
  }
};

const remove = async (key: string): Promise<void> => {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Best effort.
  }
};

const elapsedMs = (raw: string | null): number | null => {
  if (raw === null || raw === "") return null;
  const t = Number(raw);
  return Number.isFinite(t) ? Date.now() - t : null;
};

export async function markSessionBackgrounded(): Promise<void> {
  await write(BACKGROUNDED_KEY, String(Date.now()));
}

export async function clearSessionBackgrounded(): Promise<void> {
  await remove(BACKGROUNDED_KEY);
}

/** Milliseconds since the app was backgrounded, or null if never tracked. */
export async function sessionBackgroundedElapsed(): Promise<number | null> {
  return elapsedMs(await read(BACKGROUNDED_KEY));
}

export async function markSessionSeen(): Promise<void> {
  await write(LAST_SEEN_KEY, String(Date.now()));
}

export async function clearSessionSeen(): Promise<void> {
  await remove(LAST_SEEN_KEY);
}

/** Milliseconds since the app was last seen in the foreground, or null. */
export async function sessionLastSeenElapsed(): Promise<number | null> {
  return elapsedMs(await read(LAST_SEEN_KEY));
}

export async function clearSessionIdleState(): Promise<void> {
  await clearSessionBackgrounded();
  await clearSessionSeen();
}