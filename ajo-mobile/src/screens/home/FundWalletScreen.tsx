import React, { useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ApiError } from "../../api/api-error";
import { initializeFunding, verifyFunding } from "../../api/wallet";
import { colors, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<GroupsStackParamList, "GroupsList">;

export function FundWalletScreen({ navigation }: any) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleFund() {
    const amountNum = parseInt(amount, 10);
    if (!amountNum || amountNum < 100) {
      setError("Minimum funding amount is ₦100.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await initializeFunding(amountNum);
      setPaymentUrl(result.authorizationUrl);
      setReference(result.reference);
      // In a real app, you'd open this URL in a browser/webview
      // For now, we'll show the link and let the user verify after payment
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to initialize funding. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    if (!reference) return;
    setVerifying(true);
    setError(null);

    try {
      await verifyFunding(reference);
      setSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to verify payment.");
      }
    } finally {
      setVerifying(false);
    }
  }

  async function openPaymentUrl() {
    if (paymentUrl) {
      const canOpen = await Linking.canOpenURL(paymentUrl);
      if (canOpen) {
        await Linking.openURL(paymentUrl);
      }
    }
  }

  if (success) {
    return (
      <Screen>
        <View style={styles.successContainer}>
          <Text style={styles.successTitle}>Funding Successful! 🎉</Text>
          <Text style={styles.successText}>
            Your wallet has been credited.
          </Text>
          <Button
            title="Back to Wallet"
            onPress={() => navigation.goBack()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Fund Wallet</Text>
      <Text style={styles.subtitle}>
        Add money to your wallet to contribute to your savings groups.
      </Text>

      {error && <ErrorBanner message={error} />}

      <TextField
        label="Amount (₦)"
        placeholder="e.g. 5000"
        keyboardType="number-pad"
        value={amount}
        onChangeText={setAmount}
        autoFocus
      />

      {!paymentUrl && (
        <Button
          title="Continue to Payment"
          onPress={handleFund}
          loading={loading}
        />
      )}

      {paymentUrl && (
        <View>
          <Button
            title="Open Payment Page"
            onPress={openPaymentUrl}
            variant="secondary"
          />
          <Text style={styles.helperText}>
            {`After completing payment, tap "Verify Payment" below.`}
          </Text>
          <Button
            title="Verify Payment"
            onPress={handleVerify}
            loading={verifying}
            style={styles.verifyButton}
          />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => {
              setPaymentUrl(null);
              setReference(null);
            }}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  helperText: {
    fontSize: typography.sizes.sm,
    color: colors.inkFaint,
    textAlign: "center",
    marginVertical: spacing.md,
    fontStyle: "italic",
  },
  verifyButton: {
    marginBottom: spacing.sm,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  successText: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
});