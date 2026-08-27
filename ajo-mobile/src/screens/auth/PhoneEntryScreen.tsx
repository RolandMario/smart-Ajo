import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
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
import { colors, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "PhoneEntry">;

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export function PhoneEntryScreen({ navigation }: Props) {
  const { loginWithPassword } = useAuth();
  const [rawPhone, setRawPhone] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>
          Sign in with your phone number and password.
        </Text>
      </View>

      {error && <ErrorBanner message={error} />}

      <TextField
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

      <Button title="Sign In" onPress={handleLogin} loading={loading} />

      <Pressable onPress={() => navigation.navigate("ForgotPassword")} style={styles.forgotLink}>
        <Text style={styles.forgotLinkText}>Forgot password?</Text>
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account?</Text>
        <Pressable onPress={() => navigation.navigate("Register")}>
          <Text style={styles.footerLink}> Create one</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  forgotLink: {
    alignItems: "center",
    marginTop: spacing.md,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    lineHeight: 14,
  },
  rememberText: {
    fontSize: typography.sizes.sm,
    color: colors.ink,
  },
  forgotLinkText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
  },
  footerText: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
  },
  footerLink: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});