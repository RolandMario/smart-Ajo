import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { getBankAccount, setBankAccount, listBanks } from "../../api/wallet";
import type { BankAccount, BankListEntry } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<GroupsStackParamList, "GroupsList">;

export function BankAccountScreen({ navigation }: any) {
  const [existing, setExisting] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [saved, setSaved] = useState(false);

  async function fetchData() {
    try {
      const data = await getBankAccount();
      setExisting(data);
      if (data) {
        setAccountNumber(data.accountNumber);
        setBankName(data.bankName);
        setBankCode(data.bankCode);
      }
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, []),
  );

  async function handleSave() {
    if (accountNumber.length !== 10) {
      setError("Account number must be 10 digits.");
      return;
    }
    if (!bankName || !bankCode) {
      setError("Enter your bank name and code.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await setBankAccount({
        accountNumber,
        bankCode,
        bankName,
      });
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to save bank account.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingScreen />;

  if (saved) {
    return (
      <Screen>
        <View style={styles.successContainer}>
          <Text style={styles.successTitle}>Bank Account Saved! 🎉</Text>
          <Text style={styles.successText}>
            Your payout bank account has been set up successfully.
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
      <ScrollView>
        <Text style={styles.title}>Bank Account</Text>
        {existing ? (
          <Text style={styles.subtitle}>
            Update your payout bank account. This is where cycle payouts will be sent.
          </Text>
        ) : (
          <Text style={styles.subtitle}>
            Set up your payout bank account. You need this to receive cycle payouts.
          </Text>
        )}

        {error && <ErrorBanner message={error} />}

        {existing && (
          <View style={styles.currentCard}>
            <Text style={styles.currentTitle}>Current Account</Text>
            <Text style={styles.currentDetail}>
              {existing.bankName}: {existing.accountNumber}
            </Text>
            <Text style={styles.currentDetail}>
              {existing.accountName}
            </Text>
          </View>
        )}

        <TextField
          label="Account Number"
          placeholder="10-digit NUBAN"
          keyboardType="number-pad"
          maxLength={10}
          value={accountNumber}
          onChangeText={setAccountNumber}
          autoFocus
        />

        <TextField
          label="Bank Name"
          placeholder="e.g. Guaranty Trust Bank"
          value={bankName}
          onChangeText={setBankName}
        />

        <TextField
          label="Bank Code"
          placeholder="e.g. 058"
          value={bankCode}
          onChangeText={setBankCode}
        />

        <Text style={styles.helperText}>
          We use Paystack to verify and securely store your account details.
        </Text>

        <Button
          title={existing ? "Update Bank Account" : "Save Bank Account"}
          onPress={handleSave}
          loading={saving}
        />
      </ScrollView>
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
    fontSize: typography.sizes.xs,
    color: colors.inkFaint,
    fontStyle: "italic",
    marginBottom: spacing.lg,
  },
  currentCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  currentTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  currentDetail: {
    fontSize: typography.sizes.base,
    color: colors.ink,
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