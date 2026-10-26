import React, { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { SavingsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { Pagination } from "../../components/Pagination";
import { ApiError } from "../../api/api-error";
import {
  SAVING_ACTIVITY_PAGE_SIZE,
  continueSavingPlan,
  deleteSavingPlan,
  getSavingPlan,
  paySavingPlan,
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

type Props = NativeStackScreenProps<SavingsStackParamList, "SavingsPlanDetail">;

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
  // "Recent activity" is paginated 10 rows at a time ("Page 1 of N").
  const [txPage, setTxPage] = useState(1);
  const [txTotal, setTxTotal] = useState(0);
  const [txPaging, setTxPaging] = useState(false);

  /** Applies a detail payload (from a fetch or an action) + pager metadata. */
  function applyDetail(data: SavingPlanDetailType) {
    setDetail(data);
    setTxPage(data.page ?? 1);
    setTxTotal(data.total ?? data.transactions.length);
  }

  const fetchData = useCallback(
    async (page = 1, showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const data = await getSavingPlan(planId, page);
        setDetail(data);
        setTxPage(data.page ?? page);
        setTxTotal(data.total ?? data.transactions.length);
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
    },
    [planId],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchData(1, true);
    }, [fetchData]),
  );

  async function handleActivityPage(next: number) {
    setTxPaging(true);
    try {
      await fetchData(next);
    } finally {
      setTxPaging(false);
    }
  }

  async function handlePay() {
    if (!detail) return;
    const current = detail.plan;

    Alert.alert(
      "Pay from wallet?",
      `${formatNaira(current.amount)} will be moved from your Ajo wallet into "${current.name}".`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Pay",
          onPress: async () => {
            setError(null);
            setBusy(true);
            try {
              const data = await paySavingPlan(planId);
              applyDetail(data);
              if (data.plan.status === "completed") {
                Alert.alert(
                  "Cycle complete",
                  `Your ${formatNaira(data.plan.savingsBalance)} savings are ready to withdraw.`,
                );
              }
            } catch (err) {
              if (err instanceof ApiError) setError(err.message);
              else setError("Payment failed. Please try again.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  async function handleWithdraw() {
    setError(null);
    setBusy(true);
    try {
      const data = await withdrawSavingPlan(planId);
      applyDetail(data);
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
      "A new cycle will start. You'll keep funding each interval from your wallet. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          onPress: async () => {
            setError(null);
            setBusy(true);
            try {
              const data = await continueSavingPlan(planId);
              applyDetail(data);
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
        ? "No payments have been made yet. Deleting will cancel this plan. Continue?"
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
  // Mid-cycle plans created before the schedule was snapshotted can have no
  // intervalCount. Treat those as "schedule unknown" instead of dividing by
  // zero (progress NaN) and hiding the Pay button forever.
  const intervalCount = plan.intervalCount ?? 0;
  const hasSchedule = intervalCount > 0;
  const progress = hasSchedule
    ? Math.min(plan.collectedCount / intervalCount, 1)
    : 0;
  const paymentsLeft = hasSchedule
    ? Math.max(intervalCount - plan.collectedCount, 0)
    : 1;
  const canPay =
    plan.status === "active" && (hasSchedule ? paymentsLeft > 0 : true);
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
          {hasSchedule
            ? `${plan.collectedCount} of ${intervalCount} intervals collected`
            : `${plan.collectedCount} interval${plan.collectedCount === 1 ? "" : "s"} collected`}
        </Text>
        <Text style={styles.metaText}>
          Cycle #{plan.cycleNumber} · Status: {status.text}
        </Text>
        <Text style={styles.metaText}>
          {plan.status === "active"
            ? `Next payment due: ${formatDateTime(plan.nextDueAt)}`
            : `Started ${formatDate(plan.startAt)}${
                plan.endAt ? ` · Finished ${formatDate(plan.endAt)}` : ""
              }`}
        </Text>

        {canPay && (
          <View style={styles.payCard}>
            <Text style={styles.payTitle}>Fund this plan</Text>
            <Text style={styles.payText}>
              {hasSchedule
                ? `${paymentsLeft} payment${paymentsLeft === 1 ? "" : "s"} left · `
                : ""}
              {formatNaira(plan.amount)} per {plan.frequency} interval, paid
              from your Ajo wallet. Nothing is debited automatically.
            </Text>
            <Button
              title={`Pay ${formatNaira(plan.amount)} from wallet`}
              onPress={handlePay}
              loading={busy}
              style={styles.actionButton}
            />
          </View>
        )}

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

        <Pagination
          page={txPage}
          pageCount={Math.max(
            1,
            Math.ceil(txTotal / SAVING_ACTIVITY_PAGE_SIZE),
          )}
          total={txTotal}
          pageSize={SAVING_ACTIVITY_PAGE_SIZE}
          loading={txPaging}
          onChange={(next) => {
            void handleActivityPage(next);
          }}
          style={styles.pagination}
        />
      </ScrollView>
    </Screen>
  );
}

function txTypeLabel(type: string): string {
  switch (type) {
    case "saving_debit":
      return "Paid from wallet";
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
    color: colors.forestLightInk,
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
    backgroundColor: colors.forestAction,
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
    backgroundColor: colors.forestLightField,
    overflow: "hidden",
    marginVertical: spacing.sm,
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.full,
    backgroundColor: colors.forestAction,
  },
  progressText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.xs,
  },
  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    marginBottom: spacing.xs,
  },
  actionButton: {
    marginTop: spacing.lg,
  },
  payCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  payTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.xs,
  },
  payText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  continueCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  continueText: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.md,
  },
  continueButton: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  pagination: {
    paddingBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
  },
  txRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
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
    color: colors.forestLightInk,
  },
  txDate: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
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
