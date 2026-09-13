import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { WalletStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { listWalletTransactions } from "../../api/wallet";
import type { WalletTransaction } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira, formatDateTime } from "../../utils/format";
import {
  transactionTypeLabel,
  isCreditTransaction,
} from "../../utils/wallet-transactions";

type Props = NativeStackScreenProps<WalletStackParamList, "Transactions">;

const PAGE_SIZE = 15;

export function TransactionsScreen({ navigation }: Props) {
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData(mode: "initial" | "reset" | "more") {
    const nextPage = mode === "more" ? page + 1 : 1;

    try {
      const data = await listWalletTransactions(nextPage, PAGE_SIZE);
      setTransactions((current) =>
        mode === "more" ? [...current, ...data.transactions] : data.transactions,
      );
      setTotal(data.total);
      setPage(data.page);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load transactions");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData("initial");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (loading) return <LoadingScreen />;

  const hasMore = transactions.length < total;

  return (
    <Screen scrollable={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Transactions</Text>
        <Text style={styles.subtitle}>
          Every debit and credit on your Ajo wallet.
        </Text>
      </View>

      {error && <ErrorBanner message={error} />}

      <FlatList
        data={transactions}
        keyExtractor={(item) => item._id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchData("reset");
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No transactions yet</Text>
            <Text style={styles.emptySubtitle}>
              Fund your wallet or make a payment and it will show up here.
            </Text>
          </View>
        }
        ListFooterComponent={
          hasMore ? (
            <Button
              title={loadingMore ? "Loading..." : "Load more"}
              variant="secondary"
              loading={loadingMore}
              onPress={() => {
                setLoadingMore(true);
                fetchData("more");
              }}
              style={styles.loadMoreButton}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <TransactionRow
            transaction={item}
            onPress={() =>
              navigation.navigate("TransactionReceipt", { transaction: item })
            }
          />
        )}
      />
    </Screen>
  );
}

function TransactionRow({
  transaction,
  onPress,
}: {
  transaction: WalletTransaction;
  onPress: () => void;
}) {
  const credit = isCreditTransaction(transaction.type);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.transactionRow,
        pressed && { opacity: 0.7 },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View receipt for ${transactionTypeLabel(transaction.type)}`}
    >
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionType}>
          {transactionTypeLabel(transaction.type)}
        </Text>
        <Text style={styles.transactionDate}>
          {formatDateTime(transaction.createdAt)}
        </Text>
      </View>
      <View style={styles.transactionAmount}>
        <Text
          style={[
            styles.amountText,
            { color: credit ? colors.success : colors.danger },
          ]}
        >
          {credit ? "+" : "-"}
          {formatNaira(transaction.amount)}
        </Text>
        {transaction.status === "pending" && (
          <View
            style={[styles.statusBadge, { backgroundColor: colors.warningSoft }]}
          >
            <Text style={[styles.statusText, { color: colors.warning }]}>
              Pending
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
    marginTop: spacing.xs,
  },
  list: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxxl * 2,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
    textAlign: "center",
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
  loadMoreButton: {
    marginTop: spacing.sm,
  },
});