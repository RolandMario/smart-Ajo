import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { AccountStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { SubpageHeader } from "../../components/SubpageHeader";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { getCashbackWallet } from "../../api/wallet";
import { formatNairaExact } from "../../utils/format";
import {
  isCreditTransaction,
  transactionTypeLabel,
} from "../../utils/wallet-transactions";
import type { CashbackWallet } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<AccountStackParamList, "CashbackWallet">;

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Cashback wallet — the balance a member has earned on bill payments, plus
 * every movement in it (earned on a purchase, spent on one). Opened from the
 * Profile screen's "Cashback" card.
 *
 * Cashback is credited by the server as part of the purchase itself, so this
 * screen is read-only: it has no fund or withdraw action by design.
 */
export function CashbackWalletScreen({ navigation }: Props) {
  const [wallet, setWallet] = useState<CashbackWallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await getCashbackWallet();
      setWallet(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to load your cashback",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData]),
  );

  if (loading) return <LoadingScreen />;

  const transactions = wallet?.transactions ?? [];

  return (
    <Screen>
      <SubpageHeader
        title="Cashback wallet"
        onBack={() => navigation.goBack()}
      />

      {error ? <ErrorBanner message={error} /> : null}

      {/* ---- Balance ------------------------------------------- */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Cashback balance</Text>
        <Text style={styles.balanceAmount} numberOfLines={1}>
          {formatNairaExact(wallet?.balance ?? 0)}
        </Text>
        <Text style={styles.balanceHint}>
          {
            "Earned on bills you pay. Use it on your next purchase from the “Pay from” options."
          }
        </Text>
      </View>

      {/* ---- History ------------------------------------------- */}
      <Text style={styles.sectionTitle}>Cashback history</Text>

      {transactions.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No cashback yet</Text>
          <Text style={styles.emptySubtitle}>
            Pay for data, airtime, cable TV or electricity and the cashback on
            that plan lands here as soon as the purchase succeeds.
          </Text>
        </View>
      ) : (
        transactions.map((tx) => {
          const credit = isCreditTransaction(tx.type);
          return (
            <View key={tx._id} style={styles.txRow}>
              <View style={styles.txBody}>
                <Text style={styles.txTitle} numberOfLines={1}>
                  {transactionTypeLabel(tx.type)}
                </Text>
                <Text style={styles.txDate}>{formatDate(tx.createdAt)}</Text>
              </View>

              <Text style={[styles.txAmount, credit && styles.txAmountCredit]}>
                {credit ? "+" : "−"}
                {formatNairaExact(tx.amount)}
              </Text>
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    backgroundColor: colors.forestLightCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  balanceLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    marginBottom: spacing.sm,
  },
  balanceHint: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.md,
  },
  txRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  txBody: {
    flex: 1,
    minWidth: 0,
  },
  txTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  txDate: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    marginTop: 2,
  },
  txAmount: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  txAmountCredit: {
    color: colors.forestAction,
  },
  empty: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    lineHeight: 20,
  },
});

