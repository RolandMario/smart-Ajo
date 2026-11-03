import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { WalletStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { SubpageHeader } from "../../components/SubpageHeader";
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
import { loadClipboardSafe } from "../../utils/expo-clipboard-client";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<WalletStackParamList, "FundWallet">;

type FundMode = "bank" | "card";

/**
 * Bank-transfer provisioning state for the virtual account card:
 * `creating` (Paystack is minting/fetching the account) → `ready`, or
 * `error` + Retry when provisioning fails (e.g. no email on the profile, or
 * dedicated accounts aren't enabled on the Paystack business).
 */
type DvaStatus = "creating" | "ready" | "error";

/** Maps a thrown provisioning error to a member-facing message. */
function describeDvaError(err: unknown): string {
  return err instanceof ApiError
    ? err.message
    : "Could not set up your dedicated account. Please try again.";
}

export function FundWalletScreen({ navigation }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [success, setSuccess] = useState(false);

  // Bank-transfer (Dedicated Virtual Account) funding state. Bank transfer is
  // the DEFAULT tab: it needs no card, and the wallet is credited
  // automatically when the money lands.
  const [mode, setMode] = useState<FundMode>("bank");
  const [dva, setDva] = useState<DedicatedAccount | null>(null);
  const [dvaStatus, setDvaStatus] = useState<DvaStatus>("creating");
  const [dvaError, setDvaError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);

  /**
   * Provisions (or re-fetches) the member's own virtual account. Used by the
   * Retry button; the first load happens in the effect below.
   */
  const loadDva = useCallback(async () => {
    setDvaStatus("creating");
    setDvaError(null);

    try {
      const data = await getDedicatedAccount();
      setDva(data);
      setDvaStatus("ready");
      setCopied(false);
    } catch (err) {
      setDvaStatus("error");
      setDvaError(describeDvaError(err));
    }
  }, []);

  // The server creates the member's own virtual account lazily on first call,
  // so opening this screen IS the "create my account number" action. The state
  // starts in `creating`, and this effect only writes state after the request
  // resolves (a synchronous setState inside an effect would cascade renders).
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await getDedicatedAccount();

        if (!active) return;

        setDva(data);
        setDvaStatus("ready");
      } catch (err) {
        if (!active) return;

        setDvaStatus("error");
        setDvaError(describeDvaError(err));
      }
    })().catch(() => {
      // Defensive: the inner try/catch already handles API failures.
    });

    return () => {
      active = false;
    };
  }, []);

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

  /**
   * Copy via the lazily-loaded `expo-clipboard` (see the module's comment on
   * why it must not be imported at startup). Falls back to an alert showing
   * the number when the native module is unavailable.
   */
  async function copyAccountNumber() {
    if (!dva?.accountNumber) return;

    const Clipboard = await loadClipboardSafe();

    if (Clipboard) {
      try {
        await Clipboard.setStringAsync(dva.accountNumber);
        setCopied(true);
        return;
      } catch {
        // Fall through to the alert — copying is best-effort.
      }
    }

    Alert.alert(
      "Account number",
      `${dva.accountNumber}\n${dva.bankName}\n${dva.accountName}`,
    );
  }

  /** Share the account details through the OS share sheet. */
  async function shareAccountDetails() {
    if (!dva) return;

    const message = [
      "Fund my SmartThrift wallet by bank transfer:",
      `${dva.bankName} — ${dva.accountNumber}`,
      `Account name: ${dva.accountName}`,
    ].join("\n");

    try {
      await Share.share({ message });
    } catch {
      Alert.alert("Account details", message);
    }
  }

  /** Rotating the number is destructive — confirm before calling Paystack. */
  function confirmNewNumber() {
    Alert.alert(
      "Get a new account number?",
      "Your current number stops accepting transfers immediately. Money already sent to it is still credited to your wallet.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Get new number",
          style: "destructive",
          onPress: () => {
            void handleNewNumber();
          },
        },
      ],
    );
  }

  async function handleNewNumber() {
    setRotating(true);
    setDvaError(null);

    try {
      const data = await refreshDedicatedAccount();
      setDva(data);
      setDvaStatus("ready");
      setCopied(false);
    } catch (err) {
      // Keep the current card on screen; the refresh was best-effort.
      setDvaStatus(dva ? "ready" : "error");
      setDvaError(
        err instanceof ApiError
          ? err.message
          : "Could not get a new account number. Please try again.",
      );
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
      <SubpageHeader title="Fund Wallet" onBack={() => navigation.goBack()} />
      <Text style={styles.subtitle}>
        Add money to your wallet to contribute to your savings groups.
      </Text>

      <View style={styles.tabs}>
        <Button
          title="Bank Transfer"
          variant={mode === "bank" ? "primary" : "ghost"}
          style={styles.tabButton}
          onPress={() => {
            setMode("bank");
            setError(null);
          }}
        />
        <Button
          title="Card"
          variant={mode === "card" ? "primary" : "ghost"}
          style={styles.tabButton}
          onPress={() => {
            setMode("card");
            setError(null);
          }}
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
          {dvaStatus === "creating" && !dva && (
            <Text style={styles.helperText}>
              Setting up your dedicated account…
            </Text>
          )}

          {dvaError && <ErrorBanner message={dvaError} />}

          {dvaStatus === "error" && (
            <Button
              title="Retry"
              variant="secondary"
              onPress={() => {
                void loadDva();
              }}
              style={styles.retryButton}
            />
          )}

          {dva && (
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
                onPress={() => {
                  void copyAccountNumber();
                }}
              />

              <Button
                title="Share Account Details"
                variant="ghost"
                onPress={() => {
                  void shareAccountDetails();
                }}
                style={styles.shareButton}
              />

              <Text style={styles.helperText}>
                Transfer from any Nigerian bank to this account and your
                wallet is credited automatically within a few minutes.
              </Text>

              <Button title="Done" onPress={() => navigation.goBack()} />

              <Button
                title="Get a New Account Number"
                variant="ghost"
                onPress={confirmNewNumber}
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
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  helperText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkFaint,
    textAlign: "center",
    marginVertical: spacing.md,
    fontStyle: "italic",
  },
  verifyButton: {
    marginBottom: spacing.sm,
  },
  retryButton: {
    marginBottom: spacing.md,
  },
  shareButton: {
    marginTop: spacing.sm,
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
    backgroundColor: colors.forestLightPill,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  dvaLabel: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  dvaBankName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.md,
  },
  dvaNumber: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  dvaAccountName: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
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
    color: colors.forestLightInkSoft,
    textAlign: "center",
    marginBottom: spacing.xl,
  },
});