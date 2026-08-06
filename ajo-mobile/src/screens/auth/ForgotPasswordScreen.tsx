import React, { useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../api/api-error";
import { toE164Nigeria } from "../../utils/phone";
import { colors, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export function ForgotPasswordScreen({ navigation }: Props) {
  const { forgotPassword } = useAuth();
  const [rawPhone, setRawPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSendOtp() {
    const phone = toE164Nigeria(rawPhone);

    if (!E164_REGEX.test(phone)) {
      setError("Enter a valid Nigerian phone number, e.g. 0801 234 5678.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await forgotPassword(phone);
      setSent(true);
      setError(null);
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
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          {sent
            ? "If an account with that phone number exists, we've sent an OTP to it."
            : "Enter your phone number and we'll send you an OTP to reset your password."}
        </Text>
      </View>

      {error && <ErrorBanner message={error} />}

      {!sent ? (
        <>
          <TextField
            label="Phone number"
            placeholder="0801 234 5678"
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
            value={rawPhone}
            onChangeText={setRawPhone}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSendOtp}
          />

          <Button title="Send OTP" onPress={handleSendOtp} loading={loading} />
        </>
      ) : (
        <Button
          title="Enter OTP"
          onPress={() => {
            const phone = toE164Nigeria(rawPhone);
            navigation.navigate("ResetPassword", { phone });
          }}
        />
      )}

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
        <Text style={styles.backLinkText}>Back to Sign In</Text>
      </TouchableOpacity>
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
  backLink: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
  backLinkText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  },
});