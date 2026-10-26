import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { useAuth } from "../../auth/AuthContext";
import {
  loadRememberedCredentials,
  saveRememberedCredentials,
  clearRememberedCredentials,
} from "../../auth/remember-me";
import { ApiError } from "../../api/api-error";
import { toE164Nigeria } from "../../utils/phone";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "PhoneEntry">;

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

/**
 * Sign-in — the light counterpart to the welcome surface: pale forest
 * canvas, serif "Welcome back." headline, tall rounded fields, a filled
 * forest-green CTA, an `or` divider and the fingerprint affordance.
 *
 * Two deliberate deviations from the source design, both flagged in the
 * README: the footer carries the app's real brand name ("New to Ajo?" —
 * the mock's "Kolo" is the template's placeholder), and "Remember me" is
 * kept, sharing the "Forgot password?" row, because it's the only place
 * the existing persisted-credential prefill can live in this layout.
 */
export function PhoneEntryScreen({ navigation }: Props) {
  const { loginWithPassword } = useAuth();
  const [rawPhone, setRawPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefill phone + password from the last "Remember Me" session so returning
  // users after a logout don't have to re-type their credentials.
  useEffect(() => {
    let cancelled = false;
    loadRememberedCredentials()
      .then((c) => {
        if (cancelled || !c.rememberMe) return;
        setRememberMe(true);
        setRawPhone(c.phone);
        setPassword(c.password);
      })
      .catch(() => {
        // Ignore — prefill is convenience only.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleRememberMe() {
    setRememberMe((prev) => {
      const next = !prev;
      // Turning it off should purge stored credentials so a later logout
      // leaves the fields empty (only saved again after a fresh login).
      if (!next) void clearRememberedCredentials();
      return next;
    });
  }

  /**
   * Fingerprint quick sign-in is designed but not wired yet: the app
   * deliberately ships without a biometric module, and signing in silently
   * from the keychain-stored "Remember me" credentials — with no biometric
   * gate — would let anyone holding the unlocked phone straight in. Until
   * `expo-local-authentication` (hasHardware → isEnrolled → authenticate)
   * gates that stored credential, the button explains itself instead of
   * appearing to work. See the README's "Sign-in screen" note.
   */
  function handleFingerprint() {
    setNotice(
      "Fingerprint sign-in isn't enabled in this build yet. Sign in with your password once — tick Remember me to keep your details on this device.",
    );
  }

  async function handleLogin() {
    const phone = toE164Nigeria(rawPhone);

    if (!E164_REGEX.test(phone)) {
      setError("Enter a valid Nigerian phone number, e.g. 0801 234 5678.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      await loginWithPassword(phone, password);
      if (rememberMe) {
        await saveRememberedCredentials(rawPhone, password, true);
      } else {
        await clearRememberedCredentials();
      }
      // No navigation call needed — AuthContext flips status to "signedIn",
      // and the root navigator swaps to the Main tabs.
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isNetworkError) {
          setError("Couldn't reach the server. Check your connection and try again.");
        } else {
          setError(err.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen backgroundColor={colors.forestLightCanvas}>
      <StatusBar style="dark" />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
      >
        <Ionicons name="chevron-back" size={22} color={colors.forestLightInk} />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.title}>Welcome back.</Text>
        <Text style={styles.subtitle}>Sign in to see your circles and savings.</Text>
      </View>

      {error && <ErrorBanner message={error} />}

      <TextField
        variant="light"
        label="Phone number"
        placeholder="0801 234 5678"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        value={rawPhone}
        onChangeText={setRawPhone}
        autoFocus
        returnKeyType="next"
      />

      <TextField
        variant="light"
        label="Password"
        placeholder="Enter your password"
        secureTextEntry
        secureToggle
        autoComplete="password"
        textContentType="password"
        value={password}
        onChangeText={setPassword}
        returnKeyType="done"
        onSubmitEditing={handleLogin}
      />

      <View style={styles.actionRow}>
        <Pressable
          onPress={toggleRememberMe}
          style={styles.rememberRow}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: rememberMe }}
        >
          <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
            {rememberMe && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.rememberText}>Remember me</Text>
        </Pressable>

        <Pressable onPress={() => navigation.navigate("ForgotPassword")} accessibilityRole="link">
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
      </View>

      <Button
        title="Sign in"
        variant="forest"
        style={styles.cta}
        onPress={handleLogin}
        loading={loading}
      />

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerLabel}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <Button
        title="Use fingerprint"
        variant="outlineLight"
        icon="finger-print"
        style={styles.cta}
        onPress={handleFingerprint}
      />

      {notice && <Text style={styles.notice}>{notice}</Text>}

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to Ajo?</Text>
        <Pressable onPress={() => navigation.navigate("Register")} accessibilityRole="link">
          <Text style={styles.footerLink}> Create an account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginBottom: spacing.xl,
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkFaint,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: colors.forestAction,
    borderColor: colors.forestAction,
  },
  checkmark: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    lineHeight: 14,
  },
  rememberText: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
  },
  link: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestAction,
  },
  cta: {
    minHeight: 64,
    borderRadius: radii.lg,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.forestLightLine,
  },
  dividerLabel: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkFaint,
  },
  notice: {
    marginTop: spacing.md,
    textAlign: "center",
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    color: colors.forestLightInkSoft,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.xl,
  },
  footerText: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkFaint,
  },
  footerLink: {
    fontSize: typography.sizes.base,
    color: colors.forestAction,
    fontWeight: typography.weights.semibold,
  },
});