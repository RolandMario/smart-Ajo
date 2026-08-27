import React, { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { WalletStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import {
  continueSavingPlan,
  deleteSavingPlan,
  getSavingPlan,
  withdrawSavingPlan,
} from "../../api/savings";
import type { SavingPlanDetail as SavingPlanDetailType } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import {
  formatDuration,
  formatNaira,
  formatDate,
  formatDateTime,
} from "../../utils/format";

type Props = NativeStackScreenProps<WalletStackParamList, "SavingsPlanDetail">;

function statusLabel(status: string): { text: string; ready: boolean } {
  switch (status) {
    case "active":
      return { text: "Active", ready: false };
    case "completed":
      return { text: "Ready to withdraw", ready: true };
    case "withdrawn":
      return { text: "Withdrawn", ready: false };
    case "deleted":
      return { text: "Deleted", ready: false };
    default:
      return { text: status, ready: false };
  }
}

export function SavingsPlanDetailScreen({ navigation, route }: Props) {
  const { planId } = route.params;
  const [detail, setDetail] = useState<SavingPlanDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function fetchData(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const data = await getSavingPlan(planId);
      setDetail(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load savings plan");
      }
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      fetchData(true);
    }, [planId]),
  );

  async function handleWithdraw() {
    setError(null);
    setBusy(true);
    try {
      const data = await withdrawSavingPlan(planId);
      setDetail(data);
      if (data.plan.status === "withdrawn") {
        Alert.alert(
          "Withdrawal Successful",
          `${formatNaira(data.plan.savingsBalance)} has been sent to your bank account.`,
        );
      } else {
        Alert.alert(
          "Withdrawal Initiated",
          "Your savings are being sent to your bank account. This may take a few minutes.",
        );
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Withdrawal failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  function handleContinue() {
    Alert.alert(
      "Continue Savings Plan?",
      "A new cycle will start and Ajo will begin auto-saving again. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            setError(null);
            setBusy(true);
            try {
              const data = await continueSavingPlan(planId);
              setDetail(data);
            } catch (err) {
              if (err instanceof ApiError) setError(err.message);
              else setError("Could not continue the plan.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  function handleDelete() {
    const noSavingsYet =
      detail?.plan.status === "active" &&
      detail?.plan.collectedCount === 0 &&
      detail?.plan.savingsBalance === 0;

    Alert.alert(
      "Delete Savings Plan?",
      noSavingsYet
        ? "No savings have been collected yet. Deleting will cancel this plan and its future auto-savings. Continue?"
        : "This will permanently delete the savings plan account. Your saved money has already been withdrawn. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setError(null);
            setBusy(true);
            try {
              await deleteSavingPlan(planId);
              navigation.goBack();
            } catch (err) {
              if (err instanceof ApiError) setError(err.message);
              else setError("Could not delete the plan.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  if (loading && !detail) {
    return <LoadingScreen />;
  }

  if (!detail) {
    return (
      <Screen>
        {error && <ErrorBanner message={error} />}
        <Text style={styles.title}>Savings Plan</Text>
      </Screen>
    );
  }

  const plan = detail.plan;
  const status = statusLabel(plan.status);
  const progress = plan.collectedCount / plan.intervalCount;
  const durationLabel =
    plan.durationUnit && plan.durationValue
      ? formatDuration(plan.durationUnit, plan.durationValue)
      : plan.durationMonths
        ? `${plan.durationMonths} months`
        : "";

  return (
    <Screen scrollable={false}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{plan.name}</Text>
        {status.ready && (
          <View style={styles.readyBadge}>
            <Text style={styles.readyBadgeText}>
              Your savings cycle is complete — you can withdraw now!
            </Text>
          </View>
        )}

        {error && <ErrorBanner message={error} />}

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Savings balance</Text>
          <Text style={styles.balanceAmount}>
            {formatNaira(plan.savingsBalance)}
          </Text>
          <Text style={styles.balanceMeta}>
            Saving {formatNaira(plan.amount)} {plan.frequency}
            {durationLabel ? ` for ${durationLabel}` : ""}
          </Text>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          {plan.collectedCount} of {plan.intervalCount} intervals collected
        </Text>
        <Text style={styles.metaText}>
          Cycle #{plan.cycleNumber} · Status: {status.text}
        </Text>
        <Text style={styles.metaText}>
          {plan.status === "active"
            ? `Next auto-save: ${formatDateTime(plan.nextDueAt)}`
            : `Started ${formatDate(plan.startAt)}${
                plan.endAt ? ` · Finished ${formatDate(plan.endAt)}` : ""
              }`}
        </Text>

        {plan.status === "active" &&
          plan.collectedCount === 0 &&
          plan.savingsBalance === 0 && (
            <Button
              title="Delete Plan"
              variant="secondary"
              onPress={handleDelete}
              loading={busy}
              style={styles.actionButton}
            />
          )}

        {plan.status === "completed" && (
          <Button
            title={`Withdraw ${formatNaira(plan.savingsBalance)}`}
            onPress={handleWithdraw}
            loading={busy}
            style={styles.actionButton}
          />
        )}

        {plan.status === "withdrawn" && (
          <View style={styles.continueCard}>
            <Text style={styles.continueText}>
              Your savings were withdrawn to your bank account. Would you like
              to continue saving?
            </Text>
            <Button
              title="Continue Same Plan"
              variant="primary"
              onPress={handleContinue}
              loading={busy}
              style={styles.continueButton}
            />
            <Button
              title="Delete Plan"
              variant="secondary"
              onPress={handleDelete}
              loading={busy}
              style={styles.continueButton}
            />
          </View>
        )}

        <Text style={styles.sectionTitle}>Recent activity</Text>
        {detail.transactions.length === 0 ? (
          <Text style={styles.emptyText}>No activity yet.</Text>
        ) : (
          detail.transactions.map((tx) => (
            <View key={tx._id} style={styles.txRow}>
              <View style={styles.txInfo}>
                <Text style={styles.txType}>{txTypeLabel(tx.type)}</Text>
                <Text style={styles.txDate}>{formatDateTime(tx.createdAt)}</Text>
              </View>
              <Text
                style={[
                  styles.txAmount,
                  tx.type === "saving_withdrawal"
                    ? styles.txAmountOut
                    : styles.txAmountIn,
                ]}
              >
                {tx.type === "saving_withdrawal" ? "-" : "+"}
                {formatNaira(tx.amount)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

function txTypeLabel(type: string): string {
  switch (type) {
    case "saving_debit":
      return "Auto-savings collected";
    case "saving_withdrawal":
      return "Withdrawal to bank";
    case "saving_refund":
      return "Refund";
    default:
      return type;
  }
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  readyBadge: {
    backgroundColor: colors.successSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  readyBadgeText: {
    color: colors.success,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginVertical: spacing.md,
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  balanceMeta: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    opacity: 0.8,
    marginTop: spacing.xs,
  },
  progressBar: {
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceSunken,
    overflow: "hidden",
    marginVertical: spacing.sm,
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  progressText: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.inkFaint,
    marginBottom: spacing.xs,
  },
  actionButton: {
    marginTop: spacing.lg,
  },
  continueCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  continueText: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  continueButton: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
  },
  txRow: {
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
  txInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  txType: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  txDate: {
    fontSize: typography.sizes.xs,
    color: colors.inkSoft,
    marginTop: spacing.xs,
  },
  txAmount: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  txAmountIn: {
    color: colors.success,
  },
  txAmountOut: {
    color: colors.danger,
  },
});
