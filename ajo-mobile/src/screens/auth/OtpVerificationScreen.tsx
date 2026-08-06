import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { TextInput } from "react-native";
import type { AuthStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../api/api-error";
import { formatPhoneForDisplay } from "../../utils/phone";
import { colors, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "OtpVerification">;

const RESEND_COOLDOWN_SECONDS = 30;

export function OtpVerificationScreen({ route, navigation }: Props) {
  const { phone } = route.params;
  const { verifyOtp, requestOtp } = useAuth();

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleVerify() {
    if (code.length < 4) {
      setError("Enter the code we sent you.");
      return;
    }

    setError(null);
    setVerifying(true);

    try {
      await verifyOtp(phone, code);
      // No navigation call needed here — AuthContext flips `status` to
      // "signedIn", and the root navigator (see RootNavigator.tsx)
      // reacts by swapping the entire stack to the Main tabs. Trying to
      // navigate forward manually from inside the Auth stack would
      // fight that swap.
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.isNetworkError) {
          setError("Couldn't reach the server. Check your connection and try again.");
        } else {
          // Surfaces ajo-server's real message — e.g. "Invalid or
          // expired code" / "Too many attempts" — since those are
          // exactly what the user needs to know here.
          setError(err.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
      setCode("");
      inputRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setError(null);
    setResending(true);

    try {
      await requestOtp(phone);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setCode("");
    } catch {
      setError("Couldn't resend the code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Enter your code</Text>
        <Text style={styles.subtitle}>We sent a code to {formatPhoneForDisplay(phone)}.</Text>
      </View>

      {error && <ErrorBanner message={error} />}

      <TextField
        ref={inputRef}
        label="Verification code"
        placeholder="••••••"
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={8}
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleVerify}
      />

      <Button title="Verify" onPress={handleVerify} loading={verifying} />

      <View style={styles.resendRow}>
        <Text style={styles.resendText}>Didn&apos;t get a code?</Text>
        <Button
          title={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          variant="ghost"
          onPress={handleResend}
          loading={resending}
          disabled={cooldown > 0}
          style={styles.resendButton}
        />
      </View>

      <Button title="Use a different number" variant="ghost" onPress={() => navigation.goBack()} />
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
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.lg,
    gap: spacing.xs,
  },
  resendText: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
  },
  resendButton: {
    minHeight: undefined,
    paddingHorizontal: spacing.sm,
  },
});
