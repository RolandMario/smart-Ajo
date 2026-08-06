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
import { colors, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

export function ResetPasswordScreen({ route, navigation }: Props) {
  const { phone } = route.params;
  const { resetPassword } = useAuth();
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleReset() {
    if (code.length < 4) {
      setError("Enter the OTP code sent to your phone.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await resetPassword(phone, code, newPassword);
      setSuccess(true);
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

  if (success) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text style={styles.title}>Password Reset</Text>
          <Text style={styles.subtitle}>
            Your password has been reset successfully. You can now sign in with your new password.
          </Text>
        </View>

        <Button title="Back to Sign In" onPress={() => navigation.popToTop()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Set New Password</Text>
        <Text style={styles.subtitle}>
          Enter the OTP sent to your phone and choose a new password.
        </Text>
      </View>

      {error && <ErrorBanner message={error} />}

      <TextField
        label="OTP code"
        placeholder="••••••"
        keyboardType="number-pad"
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
        maxLength={8}
        value={code}
        onChangeText={(text) => setCode(text.replace(/\D/g, ""))}
        autoFocus
        returnKeyType="next"
      />

      <TextField
        label="New password"
        placeholder="At least 6 characters"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={newPassword}
        onChangeText={setNewPassword}
        returnKeyType="next"
      />

      <TextField
        label="Confirm new password"
        placeholder="Re-enter your new password"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        returnKeyType="done"
        onSubmitEditing={handleReset}
      />

      <Button title="Reset Password" onPress={handleReset} loading={loading} />

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backLink}>
        <Text style={styles.backLinkText}>Back</Text>
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