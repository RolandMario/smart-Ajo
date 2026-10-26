import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { SavingsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { AccountMenu } from "../../components/AccountMenu";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { listSavingPlans } from "../../api/savings";
import type { SavingPlan } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira, formatDate } from "../../utils/format";

type Props = NativeStackScreenProps<SavingsStackParamList, "SavingsList">;

function planStatusLabel(status: SavingPlan["status"]): string {
  switch (status) {
    case "active":
      return "Active";
    case "completed":
      return "Ready to withdraw";
    case "withdrawn":
      return "Withdrawn";
    case "deleted":
      return "Deleted";
    default:
      return status;
  }
}

export function SavingsPlansListScreen({ navigation }: Props) {
  const [plans, setPlans] = useState<SavingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    try {
      const data = await listSavingPlans();
      setPlans(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load savings plans");
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

  if (loading && plans.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <Screen scrollable={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Personal Savings</Text>
          <Text style={styles.subtitle}>
            {
              "Your own savings goals, funded from your Ajo wallet — pay each interval whenever you're ready."
            }
          </Text>
        </View>
        <AccountMenu />
      </View>

      {error && <ErrorBanner message={error} />}

      <FlatList
        data={plans}
        keyExtractor={(item) => item._id}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          fetchData();
        }}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No savings plans yet</Text>
            <Text style={styles.emptySubtitle}>
              Create a savings plan, then pay each interval from your Ajo
              wallet — nothing is debited automatically.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          // Legacy plans may arrive without a snapshotted interval count.
          const hasSchedule = Number(item.intervalCount) > 0;
          const progress = hasSchedule
            ? Math.min(item.collectedCount / item.intervalCount, 1)
            : 0;
          return (
            <Pressable
              style={styles.planCard}
              onPress={() =>
                navigation.navigate("SavingsPlanDetail", { planId: item._id })
              }
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>{item.name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    item.status === "completed" && styles.statusReady,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      item.status === "completed" && styles.statusTextReady,
                    ]}
                  >
                    {planStatusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.balance}>Savings balance</Text>
              <Text style={styles.balanceValue}>
                {formatNaira(item.savingsBalance)}
              </Text>

              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${progress * 100}%` }]}
                />
              </View>
              <Text style={styles.progressText}>
                {hasSchedule
                  ? `${item.collectedCount} of ${item.intervalCount} intervals`
                  : `${item.collectedCount} interval${item.collectedCount === 1 ? "" : "s"} paid`}{" "}
                · {formatNaira(item.amount)} {item.frequency}
              </Text>
              <Text style={styles.metaText}>
                Next payment due: {formatDate(item.nextDueAt)} · Cycle #
                {item.cycleNumber}
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.fabContainer}>
        <Button
          title="Create Savings"
          onPress={() => navigation.navigate("CreateSavingsPlan")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
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
  list: {
    flexGrow: 1,
    paddingBottom: 80,
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
    color: colors.forestLightInk,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    textAlign: "center",
  },
  planCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  planName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.forestLightPill,
  },
  statusReady: {
    backgroundColor: colors.successSoft,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.forestAction,
  },
  statusTextReady: {
    color: colors.success,
  },
  balance: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
  },
  balanceValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 8,
    borderRadius: radii.full,
    backgroundColor: colors.forestLightField,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.full,
    backgroundColor: colors.forestAction,
  },
  progressText: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.xs,
  },
  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
  },
  fabContainer: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});
