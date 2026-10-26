import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { DonationsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { AccountMenu } from "../../components/AccountMenu";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { listDonationGroups } from "../../api/donations";
import type { DonationGroup, DonationGroupsResponse } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import {
  formatDonationAmount,
  formatDonationCadence,
  formatNaira,
  pluralize,
} from "../../utils/format";

type Props = NativeStackScreenProps<DonationsStackParamList, "DonationsList">;

/**
 * Pool collections landing screen: dashboard totals for the caller, the pools
 * they belong to, and the two entry points (create a pool / join by Group ID).
 */
export function DonationsListScreen({ navigation }: Props) {
  const [data, setData] = useState<DonationGroupsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    try {
      setData(await listDonationGroups());
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load your pools");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchData();
    }, []),
  );

  if (loading && !data) {
    return <LoadingScreen />;
  }

  const groups = data?.groups ?? [];
  const stats = data?.stats;

  return (
    <Screen scrollable={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Pool Collections</Text>
          <Text style={styles.subtitle}>
            Create a pool, share its Group ID, and collect donations straight
            into your Ajo wallet.
          </Text>
        </View>
        <AccountMenu />
      </View>

      {error && <ErrorBanner message={error} />}

      {stats && (
        <View style={styles.statsRow}>
          <StatCard label="Pools" value={String(stats.poolCount)} />
          <StatCard label="You gave" value={formatNaira(stats.totalDonated)} />
          <StatCard label="You raised" value={formatNaira(stats.totalRaised)} />
        </View>
      )}

      <FlatList
        data={groups}
        keyExtractor={(item) => item._id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void fetchData();
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No pools yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a pool for a birthday, wedding or project — or join one
              with the Group ID a friend shared.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PoolCard
            group={item}
            onPress={() =>
              navigation.navigate("DonationGroupDetail", {
                groupId: item._id,
              })
            }
          />
        )}
      />

      <View style={styles.footer}>
        <Button
          title="Join with Group ID"
          variant="secondary"
          icon="enter-outline"
          onPress={() => navigation.navigate("JoinDonationGroup")}
          style={styles.footerButton}
        />
        <Button
          title="Create Pool"
          icon="gift-outline"
          onPress={() => navigation.navigate("CreateDonationGroup")}
          style={styles.footerButton}
        />
      </View>
    </Screen>
  );
}


function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function PoolCard({
  group,
  onPress,
}: {
  group: DonationGroup;
  onPress: () => void;
}) {
  const isAdmin = group.isAdmin ?? group.role === "admin";
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.cardName} numberOfLines={1}>
          {group.name}
        </Text>
        <View
          style={[
            styles.badge,
            isAdmin ? styles.badgeAdmin : styles.badgeMember,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              isAdmin ? styles.badgeTextAdmin : styles.badgeTextMember,
            ]}
          >
            {isAdmin ? "Admin" : "Member"}
          </Text>
        </View>
      </View>

      <Text style={styles.cardPurpose} numberOfLines={2}>
        {group.purpose}
      </Text>

      <Text style={styles.cardRule}>
        {formatDonationAmount(group.amountType, group.amount)} ·{" "}
        {formatDonationCadence(group.schedule, group.frequency)}
      </Text>

      <View style={styles.cardRow}>
        <View style={styles.cardMetric}>
          <Text style={styles.metricLabel}>In the pool</Text>
          <Text style={styles.metricValue}>
            {formatNaira(group.escrowBalance)}
          </Text>
        </View>
        <View style={styles.cardMetric}>
          <Text style={styles.metricLabel}>Collected</Text>
          <Text style={styles.metricValue}>
            {formatNaira(group.totalCollected)}
          </Text>
        </View>
        <View style={styles.cardMetric}>
          <Text style={styles.metricLabel}>You gave</Text>
          <Text style={styles.metricValue}>
            {formatNaira(group.myTotalDonated ?? 0)}
          </Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>
          {group.memberCount} {pluralize(group.memberCount, "member")} ·{" "}
          {group.donorCount} {pluralize(group.donorCount, "donor")}
        </Text>
        {group.status !== "active" ? (
          <Text style={[styles.pill, styles.pillClosed]}>Closed</Text>
        ) : group.alreadyDonated ? (
          <Text style={[styles.pill, styles.pillDone]}>Donated</Text>
        ) : (
          <Text style={[styles.pill, styles.pillOpen]}>Open</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
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
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.forestLightCard,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
  },
  statValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    marginTop: 2,
  },
  list: {
    flexGrow: 1,
    paddingBottom: spacing.md,
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
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardPressed: {
    backgroundColor: colors.forestLightCanvas,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  cardName: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  badgeAdmin: {
    backgroundColor: colors.goldSoft,
  },
  badgeMember: {
    backgroundColor: colors.forestLightPill,
  },
  badgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  badgeTextAdmin: {
    color: colors.gold,
  },
  badgeTextMember: {
    color: colors.forestAction,
  },
  cardPurpose: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.sm,
  },
  cardRule: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestAction,
    marginBottom: spacing.md,
  },
  cardRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  cardMetric: {
    flex: 1,
  },
  metricLabel: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
  },
  metricValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardMeta: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
  },
  pill: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  pillOpen: {
    color: colors.success,
    backgroundColor: colors.successSoft,
  },
  pillDone: {
    color: colors.forestAction,
    backgroundColor: colors.forestLightPill,
  },
  pillClosed: {
    color: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  footerButton: {
    flex: 1,
  },
});

