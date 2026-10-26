import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { SubpageHeader } from "../../components/SubpageHeader";
import { ApiError } from "../../api/api-error";
import { getGroupDetail } from "../../api/groups";
import { listCycles } from "../../api/cycles";
import type { CycleWithPaidCount, Group } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import {
  formatNaira,
  formatDayMonth,
  pluralize,
  statusLabel,
} from "../../utils/format";
import { cycleIsCurrent } from "../../utils/cycles";
import { displayName } from "../../utils/names";

type Props = NativeStackScreenProps<GroupsStackParamList, "CyclesList">;

/**
 * All cycles — the Kolo list mock on the light forest canvas: a circle
 * header (back chip + serif group name + member/cycle count) above
 * mock-style cards. Each card names the cycle's recipient, contribution and
 * pot, and the live paid count as a progress bar. The group's current cycle
 * gets a gold "Current" pill and border, resolved from the real group detail
 * (round + cycleNumber) rather than a hardcoded flag.
 */
export function CyclesListScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const [group, setGroup] = useState<Group | null>(null);
  const [cycles, setCycles] = useState<CycleWithPaidCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    try {
      const [detail, data] = await Promise.all([
        getGroupDetail(groupId),
        listCycles(groupId),
      ]);
      setGroup(detail.group);
      setCycles(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load cycles");
      }
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [groupId]),
  );

  if (loading) return <LoadingScreen />;

  return (
    <Screen scrollable={false} backgroundColor={colors.forestLightCanvas}>
      <StatusBar style="dark" />

      <SubpageHeader
        title={group?.name ?? "Circle"}
        subtitle={
          group
            ? `${pluralize(cycles.length, "cycle")} · ${pluralize(
                group.totalSlots,
                "member",
              )}`
            : undefined
        }
        onBack={() => navigation.goBack()}
      />

      {error && <ErrorBanner message={error} />}

      <FlatList
        data={cycles}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No cycles yet — the first is created when the group is
              activated.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isCurrent = cycleIsCurrent(item, group);
          const paid = item.paidCount ?? 0;
          const total = item.totalSlots;
          const percent =
            total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Cycle ${item.cycleNumber}: ${displayName(
                item.recipientMember.user.name,
              )} collects, ${paid} of ${total} paid`}
              style={({ pressed }) => [
                styles.cycleCard,
                pressed && styles.pressed,
                isCurrent && styles.cycleCardCurrent,
              ]}
              onPress={() =>
                navigation.navigate("CycleDetail", {
                  groupId,
                  cycleId: item._id,
                })
              }
            >
              <View style={styles.cycleTop}>
                <Text style={styles.cycleNumber}>
                  {item.round > 1 ? `R${item.round} · ` : ""}Cycle{" "}
                  {item.cycleNumber}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    isCurrent
                      ? styles.currentBadge
                      : item.status === "completed"
                        ? styles.completedBadge
                        : styles.openBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isCurrent
                        ? styles.currentBadgeText
                        : item.status === "completed"
                          ? styles.completedBadgeText
                          : styles.openBadgeText,
                    ]}
                  >
                    {isCurrent ? "Current" : statusLabel(item.status)}
                  </Text>
                </View>
              </View>

              <Text style={styles.recipient} numberOfLines={1}>
                {displayName(item.recipientMember.user.name)} collects
              </Text>

              <View style={styles.cardDivider} />

              <Text style={styles.configText}>
                {formatNaira(item.contributionAmount)} each ·{" "}
                {pluralize(item.totalSlots, "member")}
              </Text>

              <View style={styles.progressRow}>
                <Text style={styles.progressCount}>
                  {paid} of {total} paid · {percent}%
                </Text>
                <Text style={styles.dueText}>
                  {item.completedAt
                    ? "done"
                    : `due ${formatDayMonth(item.dueDate)}`}
                </Text>
              </View>

              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${percent}%`,
                      backgroundColor:
                        item.status === "completed"
                          ? colors.success
                          : isCurrent
                            ? colors.gold
                            : colors.forestAction,
                    },
                  ]}
                />
              </View>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxxl,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    textAlign: "center",
  },
  cycleCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cycleCardCurrent: {
    borderColor: colors.gold,
  },
  pressed: {
    opacity: 0.7,
  },
  cycleTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cycleNumber: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  currentBadge: {
    backgroundColor: colors.goldSoft,
  },
  currentBadgeText: {
    color: colors.gold,
  },
  completedBadge: {
    backgroundColor: colors.successSoft,
  },
  completedBadgeText: {
    color: colors.success,
  },
  openBadge: {
    backgroundColor: colors.forestLightPill,
  },
  openBadgeText: {
    color: colors.forestAction,
  },
  statusBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  recipient: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.forestLightLine,
    marginVertical: spacing.md,
  },
  configText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInk,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  progressCount: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  dueText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.forestTrack,
    overflow: "hidden",
    marginTop: spacing.xs,
  },
  progressFill: {
    height: 8,
    borderRadius: radii.sm,
  },
});