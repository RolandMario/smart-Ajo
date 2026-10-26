import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { Avatar } from "../../components/Avatar";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import {
  MemberRing,
  buildRingNodes,
  MAX_RING_MEMBERS,
} from "../../components/MemberRing";
import { SubpageHeader } from "../../components/SubpageHeader";
import { ApiError } from "../../api/api-error";
import { getGroupDetail } from "../../api/groups";
import {
  getCurrentCycle,
  payContributionFromWallet,
  notifyBankTransferPayment,
  confirmContribution,
  rejectContribution,
  initiatePayout,
} from "../../api/cycles";
import type { CurrentCycleResponse, Group, GroupMember } from "../../types/api";
import { useAuth } from "../../auth/AuthContext";
import { colors, radii, spacing, typography } from "../../theme";
import {
  formatNaira,
  formatDayMonth,
  formatWeekdayDayMonth,
  pluralize,
  statusLabel,
} from "../../utils/format";
import { cyclePot } from "../../utils/cycles";
import { displayName } from "../../utils/names";
import { useCycleRefresh } from "../../notifications/CycleRefreshContext";

type Props = NativeStackScreenProps<GroupsStackParamList, "CurrentCycle">;

/**
 * Current cycle — redesigned to the Kolo cycle mock on the light forest
 * canvas: a circle header (back chip, serif group name, and a Manage chip
 * through to the group detail), the rotation ring with one node per
 * contributor and the pot total in the centre, a "round" card naming the
 * recipient, and a "Your contribution" card with the live collected count.
 * It is the primary destination when tapping a group in the group list.
 * All the original behaviour is preserved: refresh on
 * focus/foreground and on the cycle-advanced push, paying a contribution
 * from the wallet or by bank transfer into the escrow account, the admin
 * verification/initiate-payout actions, and the post-payout poll that
 * swaps in the next cycle as it appears.
 *
 * A group that hasn't been activated yet resolves through the group API but
 * 400s on the current-cycle endpoint — that's rendered as a friendly
 * "not started" state rather than an error.
 */
export function CurrentCycleScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const userId = user?.id;

  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [data, setData] = useState<CurrentCycleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [payingWallet, setPayingWallet] = useState(false);
  const [notifyingTransfer, setNotifyingTransfer] = useState(false);
  const [verifyingContributionId, setVerifyingContributionId] = useState<
    string | null
  >(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payoutResult, setPayoutResult] = useState(false);
  const hasDataRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    try {
      // The group header + roster always resolve; the current-cycle endpoint
      // 400s "not activated yet" before the first cycle is created, which we
      // treat as a valid "not started" state, not an error.
      const [detail, current] = await Promise.all([
        getGroupDetail(groupId),
        getCurrentCycle(groupId).catch((err: unknown) => {
          if (err instanceof ApiError && err.statusCode === 400) return null;
          throw err;
        }),
      ]);
      setGroup(detail.group);
      setMembers(detail.members);
      setData(current);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load current cycle");
      }
      setData(null);
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

  // Refresh data when app comes to foreground (e.g., after payout completes)
  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && hasDataRef.current) {
        fetchData();
      }
    });

    return () => subscription.remove();
  }, [groupId]);

  // Update ref when data changes
  React.useEffect(() => {
    if (data) {
      hasDataRef.current = true;
    }
  }, [data]);

  // Subscribe to cycle-advanced push notifications so the screen refreshes
  // immediately when the server creates the next cycle, even for non-admin
  // members who didn't trigger the payout.
  const { subscribe } = useCycleRefresh();
  useEffect(() => {
    const unsubscribe = subscribe((eventGroupId: string) => {
      if (eventGroupId === groupId) {
        console.log(`[CycleRefresh] Cycle advanced for group ${groupId}, refreshing...`);
        fetchData();
      }
    });
    return unsubscribe;
  }, [groupId, subscribe]);

  // Clean up polling on unmount
  React.useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, []);

  async function handlePayFromWallet(contributionId: string) {
    setPayingWallet(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await payContributionFromWallet(groupId, contributionId);
      setData(result);
      setSuccess("Contribution paid from your wallet.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to pay from your wallet");
      }
    } finally {
      setPayingWallet(false);
    }
  }

  async function handleNotifyTransfer(contributionId: string) {
    setNotifyingTransfer(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await notifyBankTransferPayment(groupId, contributionId);
      setData(result);
      setSuccess(
        "Your group admin has been notified — they'll confirm the transfer shortly.",
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to notify your group admin");
      }
    } finally {
      setNotifyingTransfer(false);
    }
  }

  async function handleConfirm(contributionId: string) {
    setVerifyingContributionId(contributionId);
    setError(null);
    setSuccess(null);
    try {
      const result = await confirmContribution(groupId, contributionId);
      setData(result);
      setSuccess("Payment confirmed.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to confirm the payment");
      }
    } finally {
      setVerifyingContributionId(null);
    }
  }

  async function handleReject(contributionId: string) {
    setVerifyingContributionId(contributionId);
    setError(null);
    setSuccess(null);
    try {
      const result = await rejectContribution(groupId, contributionId);
      setData(result);
      setSuccess("Payment rejected — the member's service fee was refunded.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to reject the payment");
      }
    } finally {
      setVerifyingContributionId(null);
    }
  }

  async function handlePayout() {
    if (!data) return;
    setPaying(true);
    setError(null);
    setSuccess(null);
    try {
      const payout = await initiatePayout(groupId, data.cycle._id);

      if (payout.status === "failed") {
        // Defensive: older server builds returned a FAILED payout with a 200
        // instead of throwing. Never announce a transfer that never happened.
        setError(
          payout.failureReason
            ? `Payout failed: ${payout.failureReason}. Your group wallet has been refunded — please try again.`
            : "Payout failed. Your group wallet has been refunded — please try again.",
        );
        await fetchData();
        return;
      }

      setSuccess(
        payout.status === "pending"
          ? "Payout sent — waiting for Paystack to confirm the transfer."
          : "Payout initiated successfully!",
      );
      setPayoutResult(true);

      // Poll for the next cycle to appear (Paystack may take time to process).
      // The primary mechanism is the FCM push notification — this polling is
      // a fallback in case the notification is delayed or not delivered.
      const currentCycleNumber = data.cycle.cycleNumber;
      let pollCount = 0;
      const MAX_POLLS = 12; // 12 × 10s = 2 minutes max
      pollRef.current = setInterval(async () => {
        pollCount++;
        if (pollCount > MAX_POLLS) {
          console.log(`[Payout Poll] Max polls reached, stopping.`);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          return;
        }
        try {
          const result = await getCurrentCycle(groupId);
          console.log(
            `[Payout Poll] Current cycle: #${result.cycle.cycleNumber}, status: ${result.cycle.status}, waiting for cycle > #${currentCycleNumber}`,
          );
          if (result.cycle.cycleNumber > currentCycleNumber) {
            console.log(
              `[Payout Poll] Next cycle detected! Switching to cycle #${result.cycle.cycleNumber}`,
            );
            setData(result);
            setError(null);
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch (err) {
          console.log(`[Payout Poll] Error fetching cycle: ${String(err)}`);
        }
      }, 10000);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to initiate payout");
      }
    } finally {
      setPaying(false);
    }
  }

  if (loading) return <LoadingScreen />;

  const recipientPosition: number | null = data
    ? (data.cycle.recipientMember.position ?? data.cycle.cycleNumber)
    : null;
  const recipientIsMe =
    data != null &&
    userId != null &&
    data.cycle.recipientMember.user._id === userId;
  const nodeCount = data?.contributions.length ?? 0;
  const paidCount =
    (data?.contributions ?? []).filter((c) => c.status === "paid").length;
  const allPaid = data != null && nodeCount > 0 && paidCount === nodeCount;
  const pot = data ? cyclePot(data.cycle) : 0;
  const percent = nodeCount > 0 ? Math.round((paidCount / nodeCount) * 100) : 0;
  const nodes = data
    ? buildRingNodes({
        contributions: data.contributions,
        members,
        recipientPosition,
        currentUserId: userId,
      })
    : [];
  const myPosition = members.find((m) => m.user._id === userId)?.position;
  const myPill = recipientIsMe
    ? "Collecting now"
    : `#${myPosition ?? "—"} of ${data?.cycle.totalSlots ?? "?"}`;

  /** This member's own contribution for the cycle, if they have one. */
  const myContribution = data?.contributions.find(
    (c) => c.user._id === userId,
  );
  const myContributionUnpaid =
    myContribution != null &&
    (myContribution.status === "pending" ||
      myContribution.status === "defaulted");
  const awaitingConfirmations =
    data?.contributions.filter((c) => c.status === "awaiting_confirmation") ??
    [];

  return (
    <Screen backgroundColor={colors.forestLightCanvas}>
      <StatusBar style="dark" />

      <SubpageHeader
        title={group?.name ?? "Circle"}
        subtitle={
          !group
            ? undefined
            : data
              ? `Round ${data.cycle.round} · Cycle ${data.cycle.cycleNumber} of ${data.cycle.totalSlots}`
              : statusLabel(group.status)
        }
        onBack={() => navigation.goBack()}
        right={
          group ? (
            <Pressable
              onPress={() => navigation.navigate("GroupDetail", { groupId })}
              accessibilityRole="button"
              accessibilityLabel="Manage group"
              hitSlop={8}
              style={({ pressed }) => [
                styles.manageButton,
                pressed && styles.manageButtonPressed,
              ]}
            >
              <Text style={styles.manageText}>Manage</Text>
            </Pressable>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} />}
      {success && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}

      {!group ? null : data ? (
        <>
          {/* ---- Rotation ring ---- */}
          <View style={styles.ringCard}>
            <View style={styles.ringCardHeader}>
              <Text style={styles.ringCardTitle}>The rotation</Text>
              <View
                style={[
                  styles.statusPill,
                  data.cycle.status === "completed" && styles.statusPillDone,
                ]}
              >
                <Text
                  style={[
                    styles.statusPillText,
                    data.cycle.status === "completed" &&
                      styles.statusPillTextDone,
                  ]}
                >
                  {statusLabel(data.cycle.status)}
                </Text>
              </View>
            </View>

            <MemberRing
              nodes={nodes}
              center={
                <View>
                  <Text style={styles.potAmount}>{formatNaira(pot)}</Text>
                  <Text style={styles.potSubline}>
                    pot · {pluralize(nodeCount, "member")}
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
                <LegendDot color={colors.forestLightInkFaint} label="pending" />
              </View>
            )}
          </View>

          <View style={styles.roundCard}>
            <View style={styles.roundHeader}>
              <Avatar
                name={data.cycle.recipientMember.user.name}
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
                  {displayName(data.cycle.recipientMember.user.name)} ·{" "}
                  Position {recipientPosition} of {data.cycle.totalSlots}
                </Text>
              </View>
            </View>

            <View style={styles.cardDivider} />

            <View style={styles.statRow}>
              <StatCell
                label="Due"
                value={formatWeekdayDayMonth(data.cycle.dueDate)}
              />
              <StatCell
                label="Contribution"
                value={formatNaira(data.cycle.contributionAmount)}
              />
            </View>
          </View>

          {/* ---- Your contribution + collected count --------------- */}
          <View style={styles.myCard}>
            <View style={styles.myCardHeader}>
              <View style={styles.myIdentity}>
                <Text style={styles.myLabel}>Your contribution</Text>
                <Text style={styles.myAmount}>
                  {formatNaira(data.cycle.contributionAmount)}
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
                      color: recipientIsMe ? colors.gold : colors.forestAction,
                    },
                  ]}
                >
                  {myPill}
                </Text>
              </View>
            </View>

            <View style={styles.collectedRow}>
              <Text style={styles.collectedText}>
                {paidCount} of {nodeCount} collected · {percent}%
              </Text>
              <Text style={styles.collectedDue}>
                due {formatDayMonth(data.cycle.dueDate)}
              </Text>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${percent}%`,
                    backgroundColor: allPaid
                      ? colors.success
                      : recipientIsMe
                        ? colors.gold
                        : colors.forestAction,
                  },
                ]}
              />
            </View>
          </View>

          {/* ---- Paying: wallet, or bank transfer into the escrow DVA ---- */}
          {myContributionUnpaid && (
            <View style={styles.payCard}>
              <Text style={styles.payCardTitle}>Pay your contribution</Text>
              <Text style={styles.payCardText}>
                Pay instantly from your wallet, or transfer into the group’s
                escrow account and have your group admin confirm it.
              </Text>

              <Button
                title={`Pay ${formatNaira(myContribution.amount)} from wallet`}
                onPress={() => handlePayFromWallet(myContribution._id)}
                loading={payingWallet}
                variant="forest"
                style={styles.actionButton}
              />

              {data.escrowAccount ? (
                <>
                  <View style={styles.escrowDetails}>
                    <EscrowRow
                      label="Bank"
                      value={data.escrowAccount.bankName}
                    />
                    <EscrowRow
                      label="Account number"
                      value={data.escrowAccount.accountNumber}
                    />
                    <EscrowRow
                      label="Account name"
                      value={data.escrowAccount.accountName}
                    />
                    {myContribution.paymentReference ? (
                      <EscrowRow
                        label="Narration / ref"
                        value={myContribution.paymentReference}
                        highlight
                      />
                    ) : null}
                  </View>

                  <Button
                    title="I've sent a bank transfer"
                    onPress={() => handleNotifyTransfer(myContribution._id)}
                    loading={notifyingTransfer}
                    variant="outlineLight"
                    style={styles.actionButton}
                  />
                </>
              ) : (
                <Text style={styles.payCardHint}>
                  The group’s escrow account is still being set up — pay from
                  your wallet for now.
                </Text>
              )}
            </View>
          )}

          {myContribution?.status === "awaiting_confirmation" && (
            <View style={styles.awaitingCard}>
              <Ionicons name="time-outline" size={18} color={colors.gold} />
              <Text style={styles.awaitingText}>
                Your transfer is with your group admin for confirmation.
              </Text>
            </View>
          )}

          {/*
            A member on the roster but without a contribution row for this
            cycle (e.g. added after activation) used to see no pay card at
            all and no explanation. Say so instead of showing nothing.
          */}
          {!myContribution && data.cycle.status === "open" && (
            <View style={styles.payCard}>
              <Text style={styles.payCardTitle}>
                No contribution for you in this cycle
              </Text>
              <Text style={styles.payCardText}>
                This cycle has nothing assigned to you, so there's nothing to
                pay. Ask your group admin to check the member list.
              </Text>
            </View>
          )}

          {/* ---- Admin: verify claimed bank transfers ---- */}
          {data.isAdmin && awaitingConfirmations.length > 0 && (
            <View style={styles.verifyCard}>
              <Text style={styles.verifyTitle}>Payments to verify</Text>

              {awaitingConfirmations.map((contribution) => {
                const busy = verifyingContributionId === contribution._id;

                return (
                  <View key={contribution._id} style={styles.verifyRow}>
                    <View style={styles.verifyIdentity}>
                      <Text style={styles.verifyName} numberOfLines={1}>
                        {displayName(contribution.user.name)}
                      </Text>
                      <Text style={styles.verifyMeta}>
                        {formatNaira(contribution.amount)}
                        {contribution.claimedTransferReference
                          ? ` · ref ${contribution.claimedTransferReference}`
                          : contribution.paymentReference
                            ? ` · ${contribution.paymentReference}`
                            : ""}
                      </Text>
                    </View>

                    <View style={styles.verifyActions}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Confirm ${displayName(contribution.user.name)}'s payment`}
                        disabled={busy}
                        onPress={() => handleConfirm(contribution._id)}
                        style={({ pressed }) => [
                          styles.verifyButton,
                          styles.verifyConfirm,
                          pressed && styles.verifyButtonPressed,
                        ]}
                      >
                        <Text style={styles.verifyConfirmText}>Confirm</Text>
                      </Pressable>

                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Reject ${displayName(contribution.user.name)}'s payment`}
                        disabled={busy}
                        onPress={() => handleReject(contribution._id)}
                        style={({ pressed }) => [
                          styles.verifyButton,
                          styles.verifyReject,
                          pressed && styles.verifyButtonPressed,
                        ]}
                      >
                        <Text style={styles.verifyRejectText}>Reject</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* ---- Admin: what's still standing between this cycle and its payout ---- */}
          {data.isAdmin && data.cycle.status === "open" && !allPaid && nodeCount > 0 && (
            <View style={styles.payoutNoteCard}>
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={colors.forestLightInkSoft}
              />
              <Text style={styles.payoutNoteText}>
                Payout unlocks once every contribution is confirmed —{" "}
                {paidCount} of {nodeCount} in
                {awaitingConfirmations.length > 0
                  ? `, ${awaitingConfirmations.length} waiting for your confirmation`
                  : ""}
                .
              </Text>
            </View>
          )}

          {data.isAdmin &&
            data.cycle.status === "open" &&
            allPaid &&
            data.recipientPayoutReady === false && (
              <View style={styles.payoutNoteCard}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={colors.gold}
                />
                <Text style={styles.payoutNoteText}>
                  {displayName(data.cycle.recipientMember.user.name)} hasn't
                  added a payout bank account yet. They need to add one from
                  Wallet before this payout can go through.
                </Text>
              </View>
            )}

          {data.isAdmin &&
            allPaid &&
            data.cycle.status === "open" &&
            !payoutResult && (
              <Button
                title="Initiate payout"
                onPress={handlePayout}
                loading={paying}
                variant="gold"
                style={styles.actionButton}
              />
            )}

          {payoutResult && (
            <View style={styles.payoutResult}>
              <Text style={styles.payoutResultTitle}>Payout Status</Text>
              <Text style={styles.payoutResultText}>
                Payout initiated successfully. The recipient will be notified.
              </Text>
            </View>
          )}
        </>
      ) : (
        renderNotStarted(group)
      )}
    </Screen>
  );
}

function renderNotStarted(group: Group) {
  return (
    <View style={styles.notStartedCard}>
      <View style={styles.notStartedIcon}>
        <Ionicons name="time-outline" size={22} color={colors.forestAction} />
      </View>
      <Text style={styles.notStartedTitle}>
        {group.status === "completed"
          ? "This circle's rounds are complete"
          : "This circle hasn't started its first cycle yet"}
      </Text>
      <Text style={styles.notStartedText}>
        The current cycle and its pot will appear here once the rotation is
        locked and the group is activated.
      </Text>
    </View>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
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

/** One "label — value" line in the escrow transfer-instructions card. */
function EscrowRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.escrowRow}>
      <Text style={styles.escrowLabel}>{label}</Text>
      <Text
        style={[styles.escrowValue, highlight && styles.escrowValueHighlight]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  successBanner: {
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  successText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.success,
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
  statCell: {
    flex: 1,
    minWidth: 0,
  },
  statValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
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
  actionButton: {
    marginTop: spacing.sm,
  },
  payoutResult: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.success,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  payoutResultTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.success,
    marginBottom: spacing.xs,
  },
  payoutResultText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  manageButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.forestLightPill,
  },
  manageButtonPressed: {
    opacity: 0.7,
  },
  manageText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  notStartedCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.xl,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  notStartedIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.forestLightPill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  notStartedTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    textAlign: "center",
  },
  notStartedText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  payCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  payCardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  payCardText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
  },
  payCardHint: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    marginTop: spacing.sm,
  },
  escrowDetails: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.forestLightLine,
    gap: spacing.sm,
  },
  escrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  escrowLabel: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
  },
  escrowValue: {
    flexShrink: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    textAlign: "right",
  },
  escrowValueHighlight: {
    color: colors.gold,
    letterSpacing: 0.5,
  },
  awaitingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.goldSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  awaitingText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInk,
  },
  payoutNoteCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.forestLightCard,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  payoutNoteText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  verifyCard: {
    backgroundColor: colors.forestLightCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  verifyTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  verifyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  verifyIdentity: {
    flex: 1,
    minWidth: 0,
  },
  verifyName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  verifyMeta: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    marginTop: 2,
  },
  verifyActions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  verifyButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  verifyButtonPressed: {
    opacity: 0.8,
  },
  verifyConfirm: {
    backgroundColor: colors.successSoft,
  },
  verifyConfirmText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.success,
  },
  verifyReject: {
    backgroundColor: colors.dangerSoft,
  },
  verifyRejectText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.danger,
  },
});