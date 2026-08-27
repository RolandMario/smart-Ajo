import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type {
  MainTabParamList,
  WalletStackParamList,
} from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { getWalletSummary } from "../../api/wallet";
import type { WalletSummary } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira, formatDateTime } from "../../utils/format";

type Props = CompositeScreenProps<
  NativeStackScreenProps<WalletStackParamList, "WalletHome">,
  BottomTabScreenProps<MainTabParamList, "Wallet">
>;

const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  funding: "Wallet Funding",
  contribution_debit: "Contribution",
  contribution_refund: "Contribution Refund",
  bill_payment: "Bill Payment",
  service_fee_debit: "Service Fee",
  service_fee_credit: "Service Fee Credit",
  bill_commission_credit: "Bill Commission",
  admin_credit: "Wallet Credit",
  admin_withdrawal: "Withdrawal",
  savings_debit: "Savings",
};

function transactionTypeLabel(type: string): string {
  return TRANSACTION_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

export function WalletHomeScreen({ navigation }: Props) {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    try {
      const data = await getWalletSummary();
      setSummary(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load wallet");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, []),
  );

  if (loading) return <LoadingScreen />;

  return (
    <Screen scrollable={false}>
      <Text style={styles.title}>Wallet</Text>

      {error && <ErrorBanner message={error} />}

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your Balance</Text>
        <Text style={styles.balanceAmount}>
          {summary ? formatNaira(summary.balance) : "₦0"}
        </Text>
        {summary && <Text style={styles.currency}>{summary.currency}</Text>}
      </View>

      <View style={styles.actionRow}>
        <Button
          title="Fund Wallet"
          onPress={() => navigation.navigate("FundWallet")}
          style={styles.actionButton}
        />
        <Button
          title="Bank Account"
          variant="secondary"
          onPress={() => navigation.navigate("BankAccount")}
          style={styles.actionButton}
        />
        <Button
          title="Pay Bills"
          variant="secondary"
          onPress={() => navigation.navigate("Bills", { screen: "BillServices" })}
          style={styles.actionButton}
        />
      </View>

      <View style={styles.savingsRow}>
        <Button
          title="Create Savings"
          onPress={() => navigation.navigate("CreateSavingsPlan")}
          style={styles.savingsButton}
        />
        <Button
          title="Ajo"
          variant="secondary"
          onPress={() => navigation.navigate("GroupsTab", { screen: "GroupsList" })}
          style={styles.savingsButton}
        />
      </View>
      <Pressable
        style={styles.savingsLink}
        onPress={() => navigation.navigate("SavingsPlans")}
        accessibilityRole="button"
      >
        <Text style={styles.savingsLinkText}>View my savings plans</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Recent Transactions</Text>

      <FlatList
        data={summary?.recentTransactions ?? []}
        keyExtractor={(item) => item._id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchData();
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.transactionRow, pressed && { opacity: 0.7 }]}
            onPress={() => navigation.navigate("TransactionReceipt", { transaction: item })}
            accessibilityRole="button"
            accessibilityLabel={`View receipt for ${transactionTypeLabel(item.type)}`}
          >
            <View style={styles.transactionInfo}>
              <Text style={styles.transactionType}>
                {transactionTypeLabel(item.type)}
              </Text>
              <Text style={styles.transactionDate}>
                {formatDateTime(item.createdAt)}
              </Text>
            </View>
            <View style={styles.transactionAmount}>
              <Text
                style={[
                  styles.amountText,
                  {
                    color:
                      item.type === "funding"
                        ? colors.success
                        : colors.danger,
                  },
                ]}
              >
                {item.type === "funding" ? "+" : "-"}
                {formatNaira(item.amount)}
              </Text>
              {item.status === "pending" && (
                <View style={[styles.statusBadge, { backgroundColor: colors.warningSoft }]}>
                  <Text style={[styles.statusText, { color: colors.warning }]}>
                    Pending
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  currency: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    opacity: 0.7,
    marginTop: spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flex: 1,
  },
  savingsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  savingsButton: {
    flex: 1,
  },
  savingsLink: {
    alignSelf: "flex-start",
    marginTop: -spacing.md,
    marginBottom: spacing.lg,
  },
  savingsLinkText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    textDecorationLine: "underline",
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  list: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxxl,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
  },
  transactionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  transactionInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  transactionType: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
    textTransform: "capitalize",
  },
  transactionDate: {
    fontSize: typography.sizes.xs,
    color: colors.inkSoft,
    marginTop: spacing.xs,
  },
  transactionAmount: {
    alignItems: "flex-end",
  },
  amountText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
});