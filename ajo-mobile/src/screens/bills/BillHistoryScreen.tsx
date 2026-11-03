import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { BillsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import {
  BILL_SERVICE_META,
  BillTransactionRow,
} from "../../components/BillTransactionRow";
import { ApiError } from "../../api/api-error";
import { getBillHistory } from "../../api/bills";
import type { BillServiceType, BillTransaction } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<BillsStackParamList, "BillHistory">;

/** `all` means "no server-side filter"; every other chip is an API `serviceType`. */
type HistoryFilter = "all" | BillServiceType;

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "airtime", label: BILL_SERVICE_META.airtime.label },
  { value: "data", label: BILL_SERVICE_META.data.label },
  { value: "cable", label: BILL_SERVICE_META.cable.label },
  { value: "electricity", label: BILL_SERVICE_META.electricity.label },
];

/** Empty-state copy, narrowed to whichever chip is selected. */
function emptyCopy(filter: HistoryFilter): { title: string; subtitle: string } {
  if (filter === "all") {
    return {
      title: "No bill payments yet",
      subtitle:
        "Top up, buy data, pay your TV or electricity bill and every receipt will be kept here.",
    };
  }
  const { label } = BILL_SERVICE_META[filter];
  return {
    title: `No ${label} payments yet`,
    subtitle: `${label} receipts land here as soon as you make a payment.`,
  };
}

/**
 * Full bill-payment history for the signed-in member (GET /bills/history,
 * newest first, capped at the API's 100 most recent). Opened from the Bills
 * home's "View all"; tapping a row reopens its receipt.
 *
 * The chips filter by service category. They refetch from the server rather
 * than filtering locally, so a category still shows its own 100 newest rows
 * even when they sit outside the member's 100 newest payments overall.
 */
export function BillHistoryScreen({ navigation }: Props) {
  const [history, setHistory] = useState<BillTransaction[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Latest request wins — rapid chip taps must not paint a stale response. */
  const requestSeq = useRef(0);

  const fetchData = useCallback(async (serviceType: HistoryFilter) => {
    const seq = ++requestSeq.current;
    try {
      const billHistory = await getBillHistory(
        serviceType === "all" ? undefined : serviceType,
      );
      if (seq !== requestSeq.current) return;
      setHistory(billHistory);
      setError(null);
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(
        err instanceof ApiError ? err.message : "Failed to load bill history",
      );
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setRefreshing(false);
        setFiltering(false);
      }
    }
  }, []);

  // Refetches on focus and whenever the chip changes, so the list always
  // matches the highlighted filter.
  useFocusEffect(
    useCallback(() => {
      void fetchData(filter);
    }, [fetchData, filter]),
  );

  const selectFilter = (value: HistoryFilter) => {
    if (value === filter) return;
    setFiltering(true);
    setFilter(value);
  };

  if (loading) return <LoadingScreen />;

  const empty = emptyCopy(filter);

  return (
    <Screen scrollable={false}>
      <Text style={styles.subtitle}>
        Every airtime, data, cable and electricity payment on your wallet.
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={styles.filtersScroll}
      >
        {FILTERS.map(({ value, label }) => {
          const selected = value === filter;
          return (
            <Pressable
              key={value}
              onPress={() => selectFilter(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`Show ${label} payments`}
              style={[styles.filter, selected && styles.filterSelected]}
            >
              <Text
                style={[
                  styles.filterText,
                  selected && styles.filterTextSelected,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Fixed-height strip so swapping filters doesn't shift the list. */}
      <View style={styles.filterStatus}>
        {filtering ? (
          <ActivityIndicator size="small" color={colors.forestAction} />
        ) : null}
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <FlatList
        data={history}
        keyExtractor={(item) => item._id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void fetchData(filter);
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyGlyph}>₦</Text>
            </View>
            <Text style={styles.emptyTitle}>{empty.title}</Text>
            <Text style={styles.emptySubtitle}>{empty.subtitle}</Text>
            {filter !== "all" ? (
              <Pressable
                onPress={() => selectFilter("all")}
                accessibilityRole="button"
              >
                <Text style={styles.emptyLink}>Show all payments</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <BillTransactionRow
            transaction={item}
            onPress={() =>
              navigation.navigate("BillSuccess", {
                serviceType: item.type,
                reference: item.reference,
                amount: item.amount,
                recipient: item.recipient,
                provider: item.provider,
                metadata: item.metadata,
                createdAt: item.createdAt,
              })
            }
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.lg,
  },
  list: {
    flexGrow: 1,
  },
  filtersScroll: {
    flexGrow: 0,
  },
  filters: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  filter: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    backgroundColor: colors.white,
  },
  filterSelected: {
    backgroundColor: colors.forestLightPill,
    borderColor: colors.forestAction,
  },
  filterText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInkSoft,
  },
  filterTextSelected: {
    color: colors.forestAction,
    fontWeight: typography.weights.semibold,
  },
  filterStatus: {
    height: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.forestLightPill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyGlyph: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.forestAction,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    textAlign: "center",
  },
  emptyLink: {
    marginTop: spacing.md,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.forestAction,
  },
});
