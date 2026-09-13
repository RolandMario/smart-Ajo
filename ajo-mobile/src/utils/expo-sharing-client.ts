/**
 * Lazily loads `expo-sharing`.
 *
 * The package executes `requireNativeModule('ExpoSharing')` at module-load
 * time (see `expo-sharing/src/SharingNativeModule.ts`). A top-level import
 * anywhere on the static screen tree therefore puts that native-module
 * dependency on the **app startup path** — and on any build whose native
 * side doesn't register the module (e.g. Expo Go versions that predate it,
 * or some local/standalone builds), the import throws and the whole app
 * dies with a blank screen before a single frame renders.
 *
 * Loading it inside the share handler keeps startup safe: if the native
 * module is genuinely unavailable we return null and let the caller show
 * the graceful "Sharing isn't available on this device" alert instead of
 * crashing the app.
 */
export async function loadSharingSafe(): Promise<typeof import("expo-sharing") | null> {
  try {
    return await import("expo-sharing");
  } catch {
    return null;
  }
}