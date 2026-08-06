import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { getCurrentCycle, collectContributions, initiatePayout } from "../../api/cycles";
import type { CurrentCycleResponse } from "../../types/api";
import { useAuth } from "../../auth/AuthContext";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira, formatDate, statusLabel } from "../../utils/format";
import { useCycleRefresh } from "../../notifications/CycleRefreshContext";

type Props = NativeStackScreenProps<GroupsStackParamList, "CurrentCycle">;

export function CurrentCycleScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const [data, setData] = useState<CurrentCycleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [payoutResult, setPayoutResult] = useState<boolean>(false);
  const hasDataRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    try {
      const result = await getCurrentCycle(groupId);
      setData(result);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load current cycle");
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

  async function handleCollect() {
    if (!data) return;
    setCollecting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await collectContributions(groupId, data.cycle._id);
      setData(result);
      const paid = result.results.filter((r) => r.success).length;
      setSuccess(`Collected from ${paid} member${paid !== 1 ? "s" : ""}.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to collect contributions");
      }
    } finally {
      setCollecting(false);
    }
  }

  async function handlePayout() {
    if (!data) return;
    setPaying(true);
    setError(null);
    setSuccess(null);
    try {
      await initiatePayout(groupId, data.cycle._id);
      setSuccess("Payout initiated successfully!");
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
  if (!data) {
    return (
      <Screen>
        <Text style={styles.title}>Current Cycle</Text>
        {error && <ErrorBanner message={error} />}
        {!error && <Text style={styles.emptyText}>No active cycle found.</Text>}
      </Screen>
    );
  }

  const { cycle, contributions, isAdmin } = data;
  const paidContributions = contributions.filter((c) => c.status === "paid");
  const allPaid = paidContributions.length === contributions.length;

  return (
    <Screen>
      <ScrollView>
        <Text style={styles.title}>Current Cycle</Text>

        {error && <ErrorBanner message={error} />}
        {success && (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <InfoRow label="Cycle" value={`#${cycle.cycleNumber}`} />
          <InfoRow
            label="Recipient"
            value={cycle.recipientMember.user.name ?? cycle.recipientMember.user.phone}
          />
          <InfoRow
            label="Contribution"
            value={formatNaira(cycle.contributionAmount)}
          />
          <InfoRow
            label="Due Date"
            value={formatDate(cycle.dueDate)}
          />
          <InfoRow
            label="Progress"
            value={`${paidContributions.length}/${contributions.length} paid`}
            isLast
          />
        </View>

        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${contributions.length > 0 ? (paidContributions.length / contributions.length) * 100 : 0}%`,
                backgroundColor:
                  allPaid
                    ? colors.success
                    : paidContributions.length > 0
                    ? colors.primary
                    : colors.line,
              },
            ]}
          />
        </View>

        {/* Contributions */}
        <Text style={styles.sectionTitle}>
          Contributions ({paidContributions.length}/{contributions.length} paid)
        </Text>

        {contributions.map((c) => {
          const isMe = c.user._id === user?.id;
          return (
            <View key={c._id} style={styles.contributionRow}>
              <View style={styles.contributionInfo}>
                <Text style={styles.memberName}>
                  {isMe ? "You" : (c.user.name ?? c.user.phone)}
                </Text>
                <Text style={styles.contributionAmount}>
                  {formatNaira(c.amount)}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      c.status === "paid"
                        ? colors.successSoft
                        : c.status === "defaulted"
                        ? colors.dangerSoft
                        : colors.warningSoft,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        c.status === "paid"
                          ? colors.success
                          : c.status === "defaulted"
                          ? colors.danger
                          : colors.warning,
                    },
                  ]}
                >
                  {statusLabel(c.status)}
                </Text>
              </View>
            </View>
          );
        })}

        {/* Admin actions — only group admin can collect or payout */}
        {isAdmin && !allPaid && (
          <Button
            title="Collect Contributions"
            onPress={handleCollect}
            loading={collecting}
            style={styles.actionButton}
          />
        )}

        {isAdmin && allPaid && cycle.status === "open" && !payoutResult && (
          <Button
            title="Initiate Payout"
            onPress={handlePayout}
            loading={paying}
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
      </ScrollView>
    </Screen>
  );
}

function InfoRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
  },
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
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
  },
  infoValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line,
    marginBottom: spacing.lg,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  contributionRow: {
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
  contributionInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  memberName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  contributionAmount: {
    fontSize: typography.sizes.xs,
    color: colors.inkSoft,
    marginTop: spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  actionButton: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  payoutResult: {
    backgroundColor: colors.surface,
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
    color: colors.inkSoft,
  },
});