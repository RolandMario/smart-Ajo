/**
 * Lazily loads `expo-clipboard`.
 *
 * Like `expo-sharing`, `expo-clipboard` touches a native module. A top-level
 * import anywhere on the static screen tree would put that native-module
 * dependency on the app startup path, which can throw on builds whose native
 * side doesn't register the module (e.g. old Expo Go versions or some local
 * builds). Loading it just-in-time inside the copy handler keeps startup
 * safe: if the module is unavailable we return null and the caller shows a
 * graceful fallback instead of crashing the app.
 */
export async function loadClipboardSafe(): Promise<typeof import("expo-clipboard") | null> {
  try {
    return await import("expo-clipboard");
  } catch {
    return null;
  }
}
