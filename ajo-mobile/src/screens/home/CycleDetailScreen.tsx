import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import {
  MemberRing,
  buildRingNodes,
  MAX_RING_MEMBERS,
} from "../../components/MemberRing";
import { SubpageHeader } from "../../components/SubpageHeader";
import { Avatar } from "../../components/Avatar";
import { ApiError } from "../../api/api-error";
import { getGroupDetail } from "../../api/groups";
import { listCycles, getCurrentCycle } from "../../api/cycles";
import type {
  CycleWithPaidCount,
  Group,
  GroupMember,
  PopulatedContribution,
} from "../../types/api";
import { useAuth } from "../../auth/AuthContext";
import { colors, radii, spacing, typography } from "../../theme";
import {
  formatNaira,
  formatDate,
  formatDayMonth,
  formatWeekdayDayMonth,
  pluralize,
  statusLabel,
} from "../../utils/format";
import { cycleIsCurrent, cyclePot } from "../../utils/cycles";
import { displayName } from "../../utils/names";

type Props = NativeStackScreenProps<GroupsStackParamList, "CycleDetail">;

/**
 * Cycle detail — the Kolo cycle mock's drill-in: the same circle header as
 * the current-cycle screen, a dark forest hero card with the pot, and — when
 * the viewed cycle is the group's live one — the rotation ring driven by the
 * current cycle's real contributions. Historical cycles show a summary card
 * instead (ajo-server exposes per-member contributions only for the live
 * cycle). "View Current Cycle" is kept so a member can jump from history.
 */
export function CycleDetailScreen({ navigation, route }: Props) {
  const { groupId, cycleId } = route.params;
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [cycleData, setCycleData] = useState<CycleWithPaidCount | null>(null);
  const [contributions, setContributions] = useState<PopulatedContribution[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    try {
      const [detail, cycles] = await Promise.all([
        getGroupDetail(groupId),
        listCycles(groupId),
      ]);
      setGroup(detail.group);
      setMembers(detail.members);

      const found = cycles.find((c) => c._id === cycleId);
      if (!found) {
        setError("Cycle not found");
        setCycleData(null);
        setContributions([]);
        return;
      }
      setCycleData(found);
      setError(null);

      // Only the live cycle exposes per-member contributions — that's the
      // only cycle the ring can render truthfully.
      if (cycleIsCurrent(found, detail.group)) {
        const live = await getCurrentCycle(groupId).catch(() => null);
        setContributions(live?.contributions ?? []);
      } else {
        setContributions([]);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load cycle details");
      }
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [groupId, cycleId]),
  );

  if (loading) return <LoadingScreen />;

  const isCurrent = cycleData ? cycleIsCurrent(cycleData, group) : false;
  const paid = cycleData?.paidCount ?? 0;
  const total = cycleData?.totalSlots ?? 0;
  const percent =
    total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const pot = cycleData ? cyclePot(cycleData) : 0;
  const nodes = cycleData
    ? buildRingNodes({
        contributions,
        members,
        recipientPosition:
          cycleData.recipientMember.position ?? cycleData.cycleNumber,
        currentUserId: user?.id,
      })
    : [];

  const recipientPosition = cycleData
    ? (cycleData.recipientMember.position ?? cycleData.cycleNumber)
    : null;
  const recipientIsMe =
    cycleData != null &&
    user?.id != null &&
    cycleData.recipientMember.user._id === user.id;
  const myNodeCount = contributions.length;
  const myPaidCount = contributions.filter((c) => c.status === "paid").length;
  const myAllPaid = myNodeCount > 0 && myPaidCount === myNodeCount;
  const ringPercent =
    myNodeCount > 0 ? Math.round((myPaidCount / myNodeCount) * 100) : 0;
  const myPosition = members.find((m) => m.user._id === user?.id)?.position;
  const myPill = recipientIsMe
    ? "Collecting now"
    : `#${myPosition ?? "—"} of ${cycleData?.totalSlots ?? "?"}`;
  const dueLabel = cycleData?.completedAt ? "Collected" : "Due";
  const dueText = cycleData
    ? cycleData.completedAt
      ? formatDate(cycleData.completedAt)
      : formatWeekdayDayMonth(cycleData.dueDate)
    : "";

  return (
    <Screen backgroundColor={colors.forestLightCanvas}>
      <StatusBar style="dark" />

      <SubpageHeader
        title={group?.name ?? "Circle"}
        subtitle={
          cycleData
            ? `Round ${cycleData.round} · Cycle ${cycleData.cycleNumber} of ${cycleData.totalSlots}`
            : undefined
        }
        onBack={() => navigation.goBack()}
      />

      {error && <ErrorBanner message={error} />}

      {cycleData ? (
        <>
          {/* ---- Hero card ------------------------------------------ */}
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>
                Cycle {cycleData.cycleNumber}
              </Text>
              <View
                style={[
                  styles.heroPill,
                  isCurrent ? styles.heroPillCurrent : styles.heroPillDone,
                ]}
              >
                <Text
                  style={[
                    styles.heroPillText,
                    isCurrent
                      ? styles.heroPillTextCurrent
                      : styles.heroPillTextDone,
                  ]}
                >
                  {isCurrent ? "Current cycle" : statusLabel(cycleData.status)}
                </Text>
              </View>
            </View>

            <Text
              style={styles.heroAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatNaira(pot)}
            </Text>
            <Text style={styles.heroSub}>
              pot · {pluralize(total, "member")} ×{" "}
              {formatNaira(cycleData.contributionAmount)}
            </Text>

            <View style={styles.heroDivider} />

            <View style={styles.heroStats}>
              <StatCell onDark label={dueLabel} value={dueText} />
              <StatCell
                onDark
                label="Contribution"
                value={formatNaira(cycleData.contributionAmount)}
              />
            </View>
          </View>

          {isCurrent ? (
            <>
              {/* ---- Rotation ring ---- */}
              <View style={styles.ringCard}>
                <View style={styles.ringCardHeader}>
                  <Text style={styles.ringCardTitle}>The rotation</Text>
                  <View
                    style={[
                      styles.statusPill,
                      cycleData.status === "completed" && styles.statusPillDone,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        cycleData.status === "completed" &&
                          styles.statusPillTextDone,
                      ]}
                    >
                      {statusLabel(cycleData.status)}
                    </Text>
                  </View>
                </View>

                <MemberRing
                  nodes={nodes}
                  center={
                    <View>
                      <Text style={styles.potAmount}>{formatNaira(pot)}</Text>
                      <Text style={styles.potSubline}>
                        pot · {pluralize(myNodeCount, "member")}
                      </Text>
                    </View>
                  }
                />

                {nodes.length > MAX_RING_MEMBERS ? (
                  <Text style={styles.ringFallbackNote}>
                    {pluralize(nodes.length, "member")} in this rotation — chips
                    show the same paid / pending / defaulted state.
                  </Text>
                ) : (
                  <View style={styles.legend}>
                    <LegendDot color={colors.gold} label="receiving this cycle" />
                    <LegendDot color={colors.success} label="paid" />
                    <LegendDot
                      color={colors.forestLightInkFaint}
                      label="pending"
                    />
                  </View>
                )}
              </View>

              <View style={styles.roundCard}>
                <View style={styles.roundHeader}>
                  <Avatar
                    name={cycleData.recipientMember.user.name}
                    tone={recipientIsMe ? "gold" : "green"}
                    size={44}
                  />
                  <View style={styles.roundIdentity}>
                    <Text style={styles.roundTitle}>
                      {recipientIsMe
                        ? "You're collecting this cycle"
                        : "Collecting this cycle"}
                    </Text>
                    <Text style={styles.roundSub} numberOfLines={1}>
                      {displayName(cycleData.recipientMember.user.name)} ·{" "}
                      Position {recipientPosition} of {cycleData.totalSlots}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardDivider} />

                <View style={styles.statRow}>
                  <StatCell
                    label="Due"
                    value={formatWeekdayDayMonth(cycleData.dueDate)}
                  />
                  <StatCell
                    label="Contribution"
                    value={formatNaira(cycleData.contributionAmount)}
                  />
                </View>
              </View>

              <View style={styles.myCard}>
                <View style={styles.myCardHeader}>
                  <View style={styles.myIdentity}>
                    <Text style={styles.myLabel}>Your contribution</Text>
                    <Text style={styles.myAmount}>
                      {formatNaira(cycleData.contributionAmount)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.pill,
                      {
                        backgroundColor: recipientIsMe
                          ? colors.goldSoft
                          : colors.forestLightPill,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        {
                          color: recipientIsMe
                            ? colors.gold
                            : colors.forestAction,
                        },
                      ]}
                    >
                      {myPill}
                    </Text>
                  </View>
                </View>

                <View style={styles.collectedRow}>
                  <Text style={styles.collectedText}>
                    {myPaidCount} of {myNodeCount} collected · {ringPercent}%
                  </Text>
                  <Text style={styles.collectedDue}>
                    due {formatDayMonth(cycleData.dueDate)}
                  </Text>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${ringPercent}%`,
                        backgroundColor: myAllPaid
                          ? colors.success
                          : recipientIsMe
                            ? colors.gold
                            : colors.forestAction,
                      },
                    ]}
                  />
                </View>
              </View>
            </>
          ) : (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                {cycleData.status === "completed"
                  ? "Cycle complete"
                  : statusLabel(cycleData.status)}
              </Text>
              <Text style={styles.summaryText}>
                {displayName(cycleData.recipientMember.user.name)} collected{" "}
                {formatNaira(pot)} from {paid} of{" "}
                {pluralize(total, "member")} · {percent}%.
              </Text>

              <View style={styles.cardDivider} />

              <View style={styles.statRow}>
                <StatCell
                  label="Contribution"
                  value={formatNaira(cycleData.contributionAmount)}
                />
                <StatCell
                  label={cycleData.completedAt ? "Collected on" : "Due"}
                  value={
                    cycleData.completedAt
                      ? formatDate(cycleData.completedAt)
                      : formatWeekdayDayMonth(cycleData.dueDate)
                  }
                />
              </View>
            </View>
          )}

          {!isCurrent && (
            <Button
              title="View Current Cycle"
              onPress={() => navigation.navigate("CurrentCycle", { groupId })}
              variant="forest"
              style={styles.actionButton}
            />
          )}
        </>
      ) : null}
    </Screen>
  );
}

function StatCell({
  label,
  value,
  onDark = false,
}: {
  label: string;
  value: string;
  onDark?: boolean;
}) {
  return (
    <View style={styles.statCell}>
      <Text
        style={[styles.statValue, onDark && styles.statValueOnDark]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={[styles.statLabel, onDark && styles.statLabelOnDark]}>
        {label}
      </Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.forest,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroLabel: {
    fontSize: typography.sizes.sm,
    color: colors.onForestMuted,
  },
  heroPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  heroPillCurrent: {
    backgroundColor: colors.goldSoft,
  },
  heroPillDone: {
    backgroundColor: colors.onForestTranslucent,
  },
  heroPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  heroPillTextCurrent: {
    color: colors.gold,
  },
  heroPillTextDone: {
    color: colors.onForestMuted,
  },
  heroAmount: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.onForest,
    marginTop: spacing.md,
  },
  heroSub: {
    fontSize: typography.sizes.sm,
    color: colors.onForestMuted,
    marginTop: spacing.xs,
  },
  heroDivider: {
    height: 1,
    backgroundColor: colors.forestLine,
    marginVertical: spacing.xl,
  },
  heroStats: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  statCell: {
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  statValueOnDark: {
    color: colors.onForest,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
  },
  statLabelOnDark: {
    color: colors.onForestFaint,
  },
  ringCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  ringCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  ringCardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  statusPillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.forestAction,
  },
  statusPillDone: {
    backgroundColor: colors.successSoft,
  },
  statusPillTextDone: {
    color: colors.success,
  },
  potAmount: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  potSubline: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
  },
  ringFallbackNote: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    textAlign: "center",
    paddingHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  legend: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: radii.full,
  },
  legendText: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
  },
  roundCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  roundHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  roundIdentity: {
    flex: 1,
    minWidth: 0,
  },
  roundTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  roundSub: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.forestLightLine,
    marginVertical: spacing.lg,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  myCard: {
    backgroundColor: colors.forestLightCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  myCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  myIdentity: {
    flex: 1,
    minWidth: 0,
  },
  myLabel: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  myAmount: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    marginTop: 2,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  pillText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  collectedRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  collectedText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  collectedDue: {
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
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  summaryText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
  },
  actionButton: {
    marginTop: spacing.sm,
  },
});