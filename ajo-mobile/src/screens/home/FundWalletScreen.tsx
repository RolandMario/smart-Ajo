import React, { useState } from "react";
import {
  Clipboard,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ApiError } from "../../api/api-error";
import {
  getDedicatedAccount,
  initializeFunding,
  refreshDedicatedAccount,
  verifyFunding,
} from "../../api/wallet";
import type { DedicatedAccount } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<GroupsStackParamList, "GroupsList">;

type FundMode = "card" | "bank";

export function FundWalletScreen({ navigation }: any) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);

  // Bank-transfer (Dedicated Virtual Account) funding state.
  const [mode, setMode] = useState<FundMode>("card");
  const [dva, setDva] = useState<DedicatedAccount | null>(null);
  const [dvaLoading, setDvaLoading] = useState(false);
  const [dvaError, setDvaError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

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

  async function loadDva() {
    setDvaLoading(true);
    setDvaError(null);
    try {
      const data = await getDedicatedAccount();
      setDva(data);
      setCopied(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setDvaError(err.message);
      } else {
        setDvaError(
          "Could not fetch your virtual account. Please try again.",
        );
      }
    } finally {
      setDvaLoading(false);
    }
  }

  function openBankTab() {
    setMode("bank");
    setError(null);
    if (!dva && !dvaLoading && !dvaError) {
      loadDva();
    }
  }

  async function copyAccountNumber() {
    if (!dva?.accountNumber) return;
    try {
      Clipboard.setString(dva.accountNumber);
      setCopied(true);
    } catch {
      // Copying is best-effort — never block on it.
    }
  }

  async function handleNewNumber() {
    setRotating(true);
    setDvaError(null);
    try {
      const data = await refreshDedicatedAccount();
      setDva(data);
      setCopied(false);
    } catch (err) {
      if (err instanceof ApiError) {
        setDvaError(err.message);
      } else {
        setDvaError(
          "Could not get a new account number. Please try again.",
        );
      }
    } finally {
      setRotating(false);
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

      <View style={styles.tabs}>
        <Button
          title="Card"
          variant={mode === "card" ? "primary" : "ghost"}
          style={styles.tabButton}
          onPress={() => setMode("card")}
        />
        <Button
          title="Bank Transfer"
          variant={mode === "bank" ? "primary" : "ghost"}
          style={styles.tabButton}
          onPress={openBankTab}
        />
      </View>

      {error && <ErrorBanner message={error} />}

      {mode === "card" ? (
        <View>
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
        </View>
      ) : (
        <View>
          {dvaLoading && !dva && (
            <Text style={styles.helperText}>
              Setting up your virtual account…
            </Text>
          )}

          {dvaError && (
            <View>
              <ErrorBanner message={dvaError} />
              <Button
                title="Retry"
                variant="secondary"
                onPress={loadDva}
                loading={dvaLoading}
              />
            </View>
          )}

          {!dvaLoading && dva && !dvaError && (
            <View>
              <View style={styles.dvaCard}>
                <Text style={styles.dvaLabel}>Bank</Text>
                <Text style={styles.dvaBankName}>{dva.bankName}</Text>

                <Text style={styles.dvaLabel}>Account Number</Text>
                <Text style={styles.dvaNumber}>{dva.accountNumber}</Text>

                <Text style={styles.dvaLabel}>Account Name</Text>
                <Text style={styles.dvaAccountName}>{dva.accountName}</Text>
              </View>

              <Button
                title={copied ? "Copied ✓" : "Copy Account Number"}
                variant="secondary"
                onPress={copyAccountNumber}
              />

              <Text style={styles.helperText}>
                Transfer from any Nigerian bank to this account and your
                wallet is credited automatically within a few minutes.
              </Text>

              <Button
                title="Get a New Account Number"
                variant="ghost"
                onPress={handleNewNumber}
                loading={rotating}
                style={styles.verifyButton}
              />
            </View>
          )}
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
  tabs: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tabButton: {
    flex: 1,
  },
  dvaCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  dvaLabel: {
    fontSize: typography.sizes.xs,
    color: colors.inkFaint,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  dvaBankName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  dvaNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  dvaAccountName: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
    marginBottom: spacing.md,
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