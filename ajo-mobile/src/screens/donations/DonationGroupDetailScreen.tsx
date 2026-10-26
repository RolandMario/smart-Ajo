import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { DonationsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import {
  donateToGroup,
  getDonationGroup,
  setPoolTerminationVote,
  terminatePoolGroup,
} from "../../api/donations";
import type { DonationGroupDetail as DonationGroupDetailType } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import {
  formatDate,
  formatDonationAmount,
  formatDonationCadence,
  formatNaira,
} from "../../utils/format";
import { loadClipboardSafe } from "../../utils/expo-clipboard-client";

type Props = NativeStackScreenProps<
  DonationsStackParamList,
  "DonationGroupDetail"
>;

/**
 * Pool detail: escrow totals, the member's own giving, the donation action
 * (fixed or free-will), the shareable Group ID, recent donations and — for
 * the admin — the payout destination and payout entry point.
 */
export function DonationGroupDetailScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const [detail, setDetail] = useState<DonationGroupDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  /** True while a termination vote or the termination itself is in flight. */
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amountModal, setAmountModal] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [copying, setCopying] = useState(false);

  const fetchData = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        setDetail(await getDonationGroup(groupId));
        setError(null);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load this pool");
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [groupId],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchData(true);
    }, [fetchData]),
  );

  async function runDonate(amount?: number) {
    setError(null);
    setBusy(true);
    try {
      const data = await donateToGroup(
        groupId,
        amount === undefined ? {} : { amount },
      );
      setDetail(data);
      Alert.alert(
        "Thank you! 🎉",
        `Your donation is in the pool. The pool now holds ${formatNaira(
          data.group.escrowBalance,
        )}.`,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Donation failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleDonate() {
    if (!detail) return;
    if (!detail.canDonate) {
      Alert.alert(
        "Not available right now",
        detail.reason ?? "You cannot donate to this pool at the moment.",
      );
      return;
    }

    const group = detail.group;
    if (group.amountType === "fixed") {
      Alert.alert(
        "Confirm donation",
        `Give ${formatNaira(group.amount ?? 0)} from your Ajo wallet to "${group.name}"?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Donate",
            onPress: () => {
              void runDonate(group.amount);
            },
          },
        ],
      );
      return;
    }

    setCustomAmount("");
    setAmountModal(true);
  }

  /**
   * Saves the red/green switch. The server recomputes the tally, so the
   * response already carries the new vote count and whether the 2/3
   * threshold has been reached (which enables the terminate button).
   */
  async function handleVoteTermination(nextVote: boolean) {
    if (!detail || voting) return;

    if (!detail.termination.eligible) {
      Alert.alert(
        "Not eligible to vote",
        "Only members who have made 100% of their payment towards this pool can vote to terminate it.",
      );
      return;
    }

    setError(null);
    setVoting(true);
    try {
      setDetail(await setPoolTerminationVote(groupId, nextVote));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not save your vote. Please try again.");
      }
    } finally {
      setVoting(false);
    }
  }

  async function runTerminate() {
    setError(null);
    setVoting(true);
    try {
      await terminatePoolGroup(groupId);
      // The pool no longer exists, so this screen is stale by definition —
      // leave it (the list refetches on focus) before confirming the delete.
      navigation.goBack();
      Alert.alert(
        "Pool deleted",
        "The pool and everything in it — donations, members, payouts and its history — has been deleted for good. It no longer appears for any member.",
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not terminate this pool. Please try again.");
      }
    } finally {
      setVoting(false);
    }
  }

  function handleTerminate() {
    if (!detail || voting) return;

    if (!detail.isAdmin) {
      Alert.alert(
        "Admin only",
        "Only the pool admin can terminate this pool. Your vote still counts — the admin presses the button.",
      );
      return;
    }

    if (!detail.termination.votesMet) {
      Alert.alert(
        "Not enough votes yet",
        `${detail.termination.votes} of the ${detail.termination.requiredVotes} yes votes needed from fully paid members.`,
      );
      return;
    }

    if (!detail.termination.fundsUtilized) {
      const outstanding =
        detail.termination.totalCollected - detail.termination.totalPaidOut;
      Alert.alert(
        "Pay out the balance first",
        `${formatNaira(outstanding)} of the money donated has not been paid out yet. Every donation must reach the payout account before the pool can be terminated.`,
      );
      return;
    }

    Alert.alert(
      "Delete this pool?",
      `This permanently deletes "${detail.group.name}" along with its donations, members and payout history. The vote passed and every donation has been paid out, so nothing is left to refund.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete pool",
          style: "destructive",
          onPress: () => {
            void runTerminate();
          },
        },
      ],
    );
  }

  function submitCustomAmount() {
    const value = parseInt(customAmount, 10);
    if (!value || value < 100) {
      Alert.alert("Enter an amount", "The minimum donation is ₦100.");
      return;
    }
    setAmountModal(false);
    void runDonate(value);
  }

  async function handleCopyGroupId() {
    if (!detail) return;
    setCopying(true);
    try {
      const Clipboard = await loadClipboardSafe();
      const code = detail.group.joinCode;
      if (Clipboard) {
        await Clipboard.setStringAsync(
          `Join my Ajo pool "${detail.group.name}"\nGroup ID: ${code}`,
        );
        Alert.alert(
          "Group ID copied",
          `Share it so others can join.\n\n${code}`,
        );
      } else {
        Alert.alert("Group ID", code);
      }
    } catch {
      Alert.alert("Group ID", detail.group.joinCode);
    } finally {
      setCopying(false);
    }
  }

  if (loading && !detail) {
    return <LoadingScreen />;
  }

  if (!detail) {
    return (
      <Screen>
        {error && <ErrorBanner message={error} />}
        <Text style={styles.title}>Pool</Text>
      </Screen>
    );
  }

  const group = detail.group;
  const isAdmin = detail.isAdmin;
  const termination = detail.termination;
  /** Only the admin may end the pool, and only once both gates are open. */
  const canTerminate = isAdmin && termination.canTerminate;
  /** Donated money that has not been paid out of the pool yet. */
  const outstandingInPool = Math.max(
    0,
    termination.totalCollected - termination.totalPaidOut,
  );

  return (
    <Screen scrollable={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{group.name}</Text>
        <Text style={styles.purpose}>{group.purpose}</Text>

        <View style={styles.badgeRow}>
          <Text
            style={[
              styles.badge,
              group.status === "active"
                ? styles.badgeOpen
                : group.status === "terminated"
                  ? styles.badgeTerminated
                  : styles.badgeClosed,
            ]}
          >
            {group.status === "active"
              ? "Open"
              : group.status === "terminated"
                ? "Terminated"
                : "Closed"}
          </Text>
          <Text style={styles.badgeNeutral}>
            {formatDonationCadence(group.schedule, group.frequency)}
          </Text>
          <Text style={styles.badgeNeutral}>
            {formatDonationAmount(group.amountType, group.amount)}
          </Text>
          {isAdmin && <Text style={styles.badgeAdmin}>Admin</Text>}
        </View>

        {error && <ErrorBanner message={error} />}

        <View style={styles.card}>
          <View style={styles.voteHeader}>
            <View style={styles.voteHeaderText}>
              <Text style={styles.cardTitle}>End this pool</Text>
              <Text style={styles.voteHint}>
                {termination.terminated
                  ? "This pool was ended by a vote of its fully paid members. Donations are closed."
                  : termination.eligible
                    ? "You have paid 100% of your contribution, so you can vote. Green keeps the pool running, red votes to terminate it."
                    : "Only members who have paid 100% of their contribution to this pool can vote."}
              </Text>
            </View>
            {!termination.terminated && (
              <Switch
                value={termination.myVote}
                onValueChange={handleVoteTermination}
                disabled={!termination.eligible || voting}
                trackColor={{
                  false: termination.eligible
                    ? colors.success
                    : colors.forestLightPill,
                  true: colors.danger,
                }}
                thumbColor={colors.white}
                ios_backgroundColor={
                  termination.eligible
                    ? colors.success
                    : colors.forestLightPill
                }
                accessibilityLabel="Vote to terminate this pool"
              />
            )}
          </View>

          {!termination.terminated && (
            <>
              <Text style={styles.voteTally}>
                {termination.votes} of {termination.requiredVotes} yes votes ·{" "}
                {termination.eligibleCount}{" "}
                {termination.eligibleCount === 1
                  ? "fully paid member"
                  : "fully paid members"}
              </Text>
              <View style={styles.voteTrack}>
                <View
                  style={[
                    styles.voteFill,
                    {
                      width: `${Math.min(100, termination.percentVoted)}%`,
                    },
                  ]}
                />
              </View>

              <View style={styles.voteFundsRow}>
                <Text style={styles.voteFunds}>
                  Collected {formatNaira(termination.totalCollected)}
                </Text>
                <Text
                  style={[
                    styles.voteFunds,
                    termination.fundsUtilized && styles.voteFundsDone,
                  ]}
                >
                  Paid out {formatNaira(termination.totalPaidOut)}
                </Text>
              </View>

              {termination.fundsUtilized ? (
                <Text style={styles.voteFootnote}>
                  Every naira donated has been paid out, so the pool is fully
                  spent.
                </Text>
              ) : (
                <>
                  <Text style={styles.voteWarning}>
                    {formatNaira(outstandingInPool)} of the donated money has
                    not been paid out yet. Every donation must reach the payout
                    account before this pool can be ended.
                  </Text>
                  {isAdmin && (
                    <Button
                      title="Pay out the balance"
                      variant="secondary"
                      icon="cash-outline"
                      onPress={() =>
                        navigation.navigate("DonationPayout", {
                          groupId: group._id,
                          groupName: group.name,
                        })
                      }
                      style={styles.votePayoutButton}
                    />
                  )}
                </>
              )}

              {isAdmin ? (
                <>
                  <Button
                    title="Terminate pool group"
                    variant="danger"
                    icon="close-circle-outline"
                    onPress={handleTerminate}
                    loading={voting}
                    disabled={!canTerminate}
                    style={styles.terminateButton}
                  />
                  <Text style={styles.voteFootnote}>
                    Enabled once 2/3 of the fully paid members vote yes and
                    every donation has been paid out. Terminating deletes the
                    pool and its donations permanently.
                  </Text>
                </>
              ) : (
                <Text style={styles.voteFootnote}>
                  Votes count only from members who have paid 100% of their
                  contribution. Only the pool admin can terminate the pool, once
                  2/3 vote yes and every donation has been paid out — that
                  deletes the pool permanently.
                </Text>
              )}
            </>
          )}
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>In the pool</Text>
          <Text style={styles.heroValue}>
            {formatNaira(group.escrowBalance)}
          </Text>
          <View style={styles.heroRow}>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>Collected</Text>
              <Text style={styles.heroMetricValue}>
                {formatNaira(group.totalCollected)}
              </Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>Paid out</Text>
              <Text style={styles.heroMetricValue}>
                {formatNaira(group.totalPaidOut)}
              </Text>
            </View>
            <View style={styles.heroMetric}>
              <Text style={styles.heroMetricLabel}>Members</Text>
              <Text style={styles.heroMetricValue}>{group.memberCount}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Your giving</Text>
          <Text style={styles.myTotal}>
            {formatNaira(detail.membership.totalDonated)}
          </Text>
          <Text style={styles.myMeta}>
            {detail.membership.donationCount}{" "}
            {detail.membership.donationCount === 1 ? "donation" : "donations"} ·
            joined {formatDate(detail.membership.joinedAt)}
          </Text>
        </View>

        <View
          style={[
            styles.window,
            detail.canDonate ? styles.windowOpen : styles.windowClosed,
          ]}
        >
          <Text style={styles.windowTitle}>
            {detail.canDonate
              ? `You can donate ${detail.donationWindowLabel}`
              : detail.reason ?? "Donations are closed"}
          </Text>
          {!detail.canDonate && detail.nextDonationAt && (
            <Text style={styles.windowText}>
              Your next donation opens on {formatDate(detail.nextDonationAt)}.
            </Text>
          )}
          {detail.canDonate && group.amountType === "free_will" && (
            <Text style={styles.windowText}>
              Donors choose their amount, from ₦100.
            </Text>
          )}
        </View>

        <Button
          title={
            group.amountType === "fixed"
              ? `Donate ${formatNaira(group.amount ?? 0)}`
              : "Donate"
          }
          icon="heart-outline"
          onPress={handleDonate}
          loading={busy}
          disabled={!detail.canDonate}
        />

        <Button
          title="View all donations"
          variant="secondary"
          onPress={() =>
            navigation.navigate("DonationGroupDonations", {
              groupId: group._id,
              groupName: group.name,
            })
          }
          style={styles.secondaryButton}
        />


        {isAdmin && (
          <View style={styles.adminCard}>
            <Text style={styles.cardTitle}>Payouts</Text>
            <Text style={styles.adminLine}>
              {detail.payoutDestination
                ? `Paid to ${detail.payoutDestination.bankName} • ${detail.payoutDestination.accountNumber}`
                : "No payout bank account yet — add one before paying out."}
            </Text>
            {detail.payoutDestination && (
              <Text style={styles.adminHint}>
                {detail.payoutDestination.source === "pool"
                  ? "Using an account set for this pool."
                  : "Using the bank account saved on your profile."}
              </Text>
            )}
            <Button
              title="Manage payouts"
              variant="secondary"
              icon="cash-outline"
              onPress={() =>
                navigation.navigate("DonationPayout", {
                  groupId: group._id,
                  groupName: group.name,
                })
              }
              style={styles.adminButton}
            />
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Group ID</Text>
          <Text style={styles.joinCode}>{group.joinCode}</Text>
          <Text style={styles.adminHint}>
            Share this ID so others can join the pool.
          </Text>
          <Button
            title="Copy Group ID"
            variant="ghost"
            icon="copy-outline"
            onPress={handleCopyGroupId}
            loading={copying}
            style={styles.copyButton}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent donations</Text>
          <Pressable
            onPress={() =>
              navigation.navigate("DonationGroupDonations", {
                groupId: group._id,
                groupName: group.name,
              })
            }
          >
            <Text style={styles.linkText}>See all</Text>
          </Pressable>
        </View>

        {detail.recentDonations.length === 0 ? (
          <Text style={styles.emptyText}>
            No donations yet. Be the first to give!
          </Text>
        ) : (
          detail.recentDonations.map((donation) => (
            <View key={donation._id} style={styles.donationRow}>
              <View style={styles.donationInfo}>
                <Text style={styles.donationName}>{donation.donorName}</Text>
                <Text style={styles.donationMeta}>
                  {formatDate(donation.createdAt)}
                </Text>
              </View>
              <Text style={styles.donationAmount}>
                {formatNaira(donation.amount)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Modal
        visible={amountModal}
        transparent
        animationType="fade"
        onRequestClose={() => setAmountModal(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose your donation</Text>
            <Text style={styles.modalSubtitle}>
              The amount is debited from your Ajo wallet.
            </Text>
            <TextInput
              style={styles.modalInput}
              keyboardType="number-pad"
              placeholder="e.g. 1000"
              placeholderTextColor={colors.forestLightInkFaint}
              value={customAmount}
              onChangeText={setCustomAmount}
              autoFocus
            />
            <Button
              title="Donate"
              onPress={submitCustomAmount}
              loading={busy}
              disabled={!customAmount.trim()}
            />
            <Button
              title="Cancel"
              variant="ghost"
              onPress={() => setAmountModal(false)}
              style={styles.modalCancel}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}


const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxxl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  purpose: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  badge: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  badgeOpen: {
    color: colors.success,
    backgroundColor: colors.successSoft,
  },
  badgeClosed: {
    color: colors.warning,
    backgroundColor: colors.warningSoft,
  },
  badgeTerminated: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  badgeNeutral: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    backgroundColor: colors.forestLightPill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  badgeAdmin: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.gold,
    backgroundColor: colors.goldSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  hero: {
    backgroundColor: colors.forest,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroLabel: {
    fontSize: typography.sizes.xs,
    color: colors.onForestMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroValue: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  heroMetric: {
    flex: 1,
  },
  heroMetricLabel: {
    fontSize: typography.sizes.xs,
    color: colors.onForestMuted,
  },
  heroMetricValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.white,
    marginTop: 2,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInkFaint,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  myTotal: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  myMeta: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
  },
  window: {
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  windowOpen: {
    backgroundColor: colors.successSoft,
    borderColor: colors.successSoft,
  },
  windowClosed: {
    backgroundColor: colors.forestLightCard,
    borderColor: colors.forestLightLine,
  },
  windowTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  windowText: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  voteHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  voteHeaderText: {
    flex: 1,
  },
  voteHint: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  voteTally: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInk,
    marginTop: spacing.md,
  },
  voteTrack: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.forestLightPill,
    marginTop: spacing.sm,
    overflow: "hidden",
  },
  voteFill: {
    height: 6,
    borderRadius: radii.full,
    backgroundColor: colors.danger,
  },
  voteFundsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  voteFunds: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
  },
  voteFundsDone: {
    color: colors.success,
    fontWeight: typography.weights.medium,
  },
  voteWarning: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  votePayoutButton: {
    marginTop: spacing.sm,
  },
  terminateButton: {
    marginTop: spacing.md,
  },
  voteFootnote: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    lineHeight: 16,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    marginTop: spacing.sm,
  },
  adminCard: {
    backgroundColor: colors.forestLightCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  adminLine: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInk,
    marginBottom: spacing.xs,
  },
  adminHint: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    lineHeight: 16,
  },
  adminButton: {
    marginTop: spacing.md,
  },
  joinCode: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    letterSpacing: 2,
    color: colors.forestAction,
    marginVertical: spacing.xs,
  },
  copyButton: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  linkText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestAction,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkFaint,
    fontStyle: "italic",
  },
  donationRow: {
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
  donationInfo: {
    flex: 1,
  },
  donationName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInk,
  },
  donationMeta: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    marginTop: 2,
  },
  donationAmount: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestAction,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 33, 26, 0.45)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  modalSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    backgroundColor: colors.forestLightField,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.lg,
    color: colors.forestLightInk,
    marginBottom: spacing.md,
  },
  modalCancel: {
    marginTop: spacing.xs,
  },
});
