import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../api/api-error";
import { toE164Nigeria } from "../../utils/phone";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

const E164_REGEX = /^\+[1-9]\d{7,14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/**
 * Mirrors ajo-server's RegisterDto rule (min 6, at least one letter and
 * one number) so a weak password is caught here rather than coming back
 * as a server error on a screen that looks like it accepted it.
 */
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)/;
/** Server caps `name` at 100 chars (UpdateProfileDto). */
const NAME_MAX_LENGTH = 100;

const TERMS_COPY = "I agree to Ajo's Terms of Service and Privacy Policy.";

/**
 * Create account — the light counterpart to the sign-in screen: pale forest
 * canvas, a circular outlined back button with a serif "Create account" title
 * centred beside it, four tall rounded fields, a consent checkbox and a
 * filled forest-green CTA.
 *
 * Two deliberate deviations from the source design, both flagged in the
 * README. The step chrome ("Step 1 of 3" plus the segment bar) is omitted:
 * registration is a single `POST /auth/register` call with no wizard behind
 * it, so the bar would advertise steps that don't exist. And the email field
 * is labelled "Email" rather than "Email (optional)" because ajo-server's
 * RegisterDto requires a real address — the design's label would promise
 * something the backend rejects.
 *
 * `fullName` is not part of the register request either; it travels in the
 * navigation params and is written to the profile once a token exists (see
 * OtpVerificationScreen).
 */
export function RegisterScreen({ navigation }: Props) {
  const { registerNewUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [rawPhone, setRawPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    const phone = toE164Nigeria(rawPhone);

    if (fullName.trim().length < 2) {
      setError("Enter your full name.");
      return;
    }

    if (!E164_REGEX.test(phone)) {
      setError("Enter a valid Nigerian phone number, e.g. 0801 234 5678.");
      return;
    }

    if (!EMAIL_REGEX.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 6 || !PASSWORD_REGEX.test(password)) {
      setError(
        "Password must be at least 6 characters and include a letter and a number.",
      );
      return;
    }

    if (!agreedToTerms) {
      setError("Please agree to the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await registerNewUser(phone, email, password);
      // The name travels with the navigation params: /auth/register accepts
      // only { phone, email, password }, and no token exists until the code
      // is verified — so the OTP screen writes it to the profile instead.
      navigation.navigate("OtpVerification", { phone, fullName: fullName.trim() });
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

      <View style={styles.headerRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.forestLightInk} />
        </Pressable>

        <Text style={styles.headerTitle}>Create account</Text>

        {/* Balances the back button so the title sits dead centre. */}
        <View style={styles.headerSpacer} />
      </View>

      {error && <ErrorBanner message={error} />}

      <TextField
        variant="light"
        label="Full name"
        placeholder="Your name"
        autoComplete="name"
        textContentType="name"
        maxLength={NAME_MAX_LENGTH}
        value={fullName}
        onChangeText={setFullName}
        autoFocus
        returnKeyType="next"
      />

      <TextField
        variant="light"
        label="Phone number"
        placeholder="0801 234 5678"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        value={rawPhone}
        onChangeText={setRawPhone}
        returnKeyType="next"
      />

      <TextField
        variant="light"
        label="Email"
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        returnKeyType="next"
      />

      <TextField
        variant="light"
        label="Password"
        placeholder="At least 6 characters"
        secureTextEntry
        secureToggle
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        value={password}
        onChangeText={setPassword}
        returnKeyType="done"
        onSubmitEditing={handleRegister}
      />

      <Pressable
        onPress={() => setAgreedToTerms((agreed) => !agreed)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreedToTerms }}
        accessibilityLabel={TERMS_COPY}
        style={styles.termsRow}
      >
        <View style={[styles.checkbox, agreedToTerms && styles.checkboxActive]}>
          {agreedToTerms ? (
            <Ionicons name="checkmark" size={16} color={colors.white} />
          ) : null}
        </View>
        <Text style={styles.termsText}>{TERMS_COPY}</Text>
      </Pressable>

      {/* Absorbs the slack on tall screens so the CTA and footer settle
          towards the bottom, as the design composes them. Collapses to its
          minHeight once the content is tall enough to scroll on its own. */}
      <View style={styles.spacer} />

      <Button
        title="Continue"
        variant="forest"
        style={styles.cta}
        onPress={handleRegister}
        loading={loading}
      />

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account?</Text>
        {/* The footer promises the sign-in screen, which isn't necessarily
            where goBack() lands — Register is reachable from Welcome too. */}
        <Pressable onPress={() => navigation.navigate("PhoneEntry")} accessibilityRole="link">
          <Text style={styles.footerLink}> Sign in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xxl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    alignItems: "center",
    justifyContent: "center",
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  headerTitle: {
    // flex + centre alignment keeps the title optically centred: both
    // siblings are 44pt wide, so the middle of this box is the middle of
    // the screen.
    flex: 1,
    textAlign: "center",
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  /** Matches the back button's footprint so the title stays centred. */
  headerSpacer: {
    width: 44,
    height: 44,
  },
  /** See the JSX note: absorbs vertical slack on tall screens. */
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
  termsRow: {
    flexDirection: "row",
    // Top-aligned so the box stays put when the copy wraps to two lines.
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
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
  termsText: {
    flex: 1,
    fontSize: typography.sizes.base,
    lineHeight: 24,
    color: colors.forestLightInkSoft,
  },
  cta: {
    minHeight: 64,
    borderRadius: radii.lg,
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