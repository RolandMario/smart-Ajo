import React, { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { DonationsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { Pagination } from "../../components/Pagination";
import { ApiError } from "../../api/api-error";
import { DONATION_PAGE_SIZE, listDonationHistory } from "../../api/donations";
import type { Donation } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatDateTime, formatDonationPeriod, formatNaira } from "../../utils/format";

type Props = NativeStackScreenProps<
  DonationsStackParamList,
  "DonationGroupDonations"
>;

/**
 * Paginated donor history for a pool, 10 rows at a time. Every member can see
 * it — a cooperative pool is transparent about who gave what.
 */
export function DonationGroupDonationsScreen({ route }: Props) {
  const { groupId, groupName } = route.params;
  const [rows, setRows] = useState<Donation[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalCollected, setTotalCollected] = useState(0);
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(
    async (targetPage: number, initial = false) => {
      if (initial) setLoading(true);
      try {
        const data = await listDonationHistory(
          groupId,
          targetPage,
          DONATION_PAGE_SIZE,
        );
        setRows(data.donations);
        setPage(data.page);
        setTotalPages(Math.max(1, data.totalPages));
        setTotal(data.total);
        setTotalCollected(data.totalCollected);
        setError(null);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load donations");
        }
      } finally {
        if (initial) setLoading(false);
      }
    },
    [groupId],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchData(1, true);
    }, [fetchData]),
  );

  async function handlePage(next: number) {
    if (next === page) return;
    setPaging(true);
    try {
      await fetchData(next);
    } finally {
      setPaging(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Screen scrollable={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{groupName ?? "Donations"}</Text>
        <Text style={styles.subtitle}>
          {total} {total === 1 ? "donation" : "donations"} ·{" "}
          {formatNaira(totalCollected)} collected
        </Text>
      </View>

      {error && <ErrorBanner message={error} />}

      <FlatList
        data={rows}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No donations yet</Text>
            <Text style={styles.emptySubtitle}>
              Donations will appear here as members give to the pool.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowInfo}>
              <Text style={styles.donor}>{item.donorName}</Text>
              <Text style={styles.meta}>
                {formatDateTime(item.createdAt)} ·{" "}
                {formatDonationPeriod(item.period)}
              </Text>
            </View>
            <Text style={styles.amount}>{formatNaira(item.amount)}</Text>
          </View>
        )}
        ListFooterComponent={
          <Pagination
            page={page}
            pageCount={totalPages}
            onChange={handlePage}
            total={total}
            pageSize={DONATION_PAGE_SIZE}
            loading={paging}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
  },
  list: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.lg,
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  donor: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInk,
  },
  meta: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    marginTop: 2,
  },
  amount: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestAction,
  },
});
