import * as SecureStore from "expo-secure-store";

/**
 * "Remember Me" credential persistence for the sign-in screen.
 *
 * When the user ticks "Remember me" and signs in, the phone + password are
 * stored in the platform keychain so they survive an explicit logout and are
 * prefilled on the next visit to the sign-in screen. When the option is
 * unchecked we purge the stored values — logging out again clears the fields.
 */

const PHONE_KEY = "ajo_remember_phone";
const PASSWORD_KEY = "ajo_remember_password";
const FLAG_KEY = "ajo_remember_me";

export interface RememberedCredentials {
  phone: string;
  password: string;
  rememberMe: boolean;
}

export async function loadRememberedCredentials(): Promise<RememberedCredentials> {
  try {
    const phone = await SecureStore.getItemAsync(PHONE_KEY);
    const password = await SecureStore.getItemAsync(PASSWORD_KEY);
    const flag = await SecureStore.getItemAsync(FLAG_KEY);
    return {
      phone: phone ?? "",
      password: password ?? "",
      rememberMe: flag === "true",
    };
  } catch {
    // SecureStore can throw on emulators without a keychain — treat as no
    // remembered credentials rather than crashing the sign-in screen.
    return { phone: "", password: "", rememberMe: false };
  }
}

/**
 * Stores the credentials when "Remember Me" is on, or clears them when it is
 * turned off. Best effort — persistence is a convenience, never a gate.
 */
export async function saveRememberedCredentials(
  phone: string,
  password: string,
  rememberMe: boolean,
): Promise<void> {
  if (!rememberMe) {
    await clearRememberedCredentials();
    return;
  }
  try {
    await SecureStore.setItemAsync(PHONE_KEY, phone);
    await SecureStore.setItemAsync(PASSWORD_KEY, password);
    await SecureStore.setItemAsync(FLAG_KEY, "true");
  } catch {
    // Ignore — stored credentials simply won't survive logout.
  }
}

export async function clearRememberedCredentials(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PHONE_KEY);
    await SecureStore.deleteItemAsync(PASSWORD_KEY);
    await SecureStore.deleteItemAsync(FLAG_KEY);
  } catch {
    // Ignore.
  }
}