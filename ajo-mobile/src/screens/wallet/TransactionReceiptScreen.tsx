import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import type { WalletStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { getReceipt } from "../../api/bills";
import type { BillTransaction } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira } from "../../utils/format";
import { billReceiptRows } from "../../utils/bill-details";

type Props = NativeStackScreenProps<WalletStackParamList, "TransactionReceipt">;

const TYPE_LABELS: Record<string, string> = {
  funding: "Wallet Funding",
  contribution_debit: "Contribution",
  contribution_refund: "Contribution Refund",
  bill_payment: "Bill Payment",
  service_fee_debit: "Service Fee",
  service_fee_credit: "Service Fee Credit",
  bill_commission_credit: "Bill Commission",
  admin_credit: "Wallet Credit",
  admin_withdrawal: "Withdrawal",
  savings_debit: "Savings",
};

const SERVICE_LABELS: Record<string, string> = {
  airtime: "Airtime",
  data: "Data",
  cable: "Cable TV",
  electricity: "Electricity",
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Human label for a bill payment (e.g. "Airtime", "Dstv", "Ekedc"). */
function billServiceLabel(billType?: string, provider?: string): string {
  if (!billType) return "Bill Payment";
  if (billType === "cable") return provider ? titleCase(provider) : "Cable TV";
  return SERVICE_LABELS[billType] ?? titleCase(billType);
}

function typeLabel(type: string, bill?: BillTransaction | null): string {
  if (type === "bill_payment" && bill) return billServiceLabel(bill.type, bill.provider);
  return TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColors(status: string) {
  const color =
    status === "success" ? colors.success : status === "failed" ? colors.danger : colors.warning;
  const background =
    status === "success" ? colors.successSoft : status === "failed" ? colors.dangerSoft : colors.warningSoft;
  return { color, background };
}

export function TransactionReceiptScreen({ navigation, route }: Props) {
  const { transaction } = route.params;
  const receiptRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  const [billDetail, setBillDetail] = useState<BillTransaction | null>(null);

  useEffect(() => {
    if (transaction.type !== "bill_payment") return;
    let cancelled = false;
    (async () => {
      try {
        const receipt = await getReceipt(transaction.reference);
        if (!cancelled) setBillDetail(receipt);
      } catch {
        // Bill receipt details are optional — the receipt below falls back to
        // the wallet transaction's captured metadata, so a missing bill record
        // must not surface a confusing "Receipt not found" banner at the top.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [transaction.type, transaction.reference]);

  const { color: statusColor, background: statusBackground } = statusColors(transaction.status);
  const isCredit =
    transaction.type === "funding" ||
    transaction.type === "contribution_refund" ||
    transaction.type === "service_fee_credit" ||
    transaction.type === "bill_commission_credit" ||
    transaction.type === "admin_credit";

  const handleShare = useCallback(async () => {
    if (!receiptRef.current) return;
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Sharing isn't available on this device.");
        return;
      }
      const uri = await captureRef(receiptRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share Receipt",
        UTI: "public.png",
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      Alert.alert("Couldn't share", message || "Something went wrong while sharing.");
    } finally {
      setSharing(false);
    }
  }, []);

  const rawRecipient = billDetail?.recipient ?? transaction.metadata?.recipient;
  const externalReference =
    billDetail?.externalReference ??
    (typeof transaction.metadata?.externalReference === "string"
      ? transaction.metadata.externalReference
      : undefined);

  // Bill payments render type-specific rows (network, data plan, cable
  // package/subscriber, electricity disco/token/customer...). When the stored
  // receipt can't be fetched (e.g. server hiccup), fall back to the wallet
  // transaction's captured metadata so the most useful fields still show.
  const billRows =
    transaction.type === "bill_payment"
      ? billReceiptRows(
          billDetail ?? {
            type: String(transaction.metadata?.type ?? "bill_payment"),
            recipient:
              typeof rawRecipient === "string" && rawRecipient.length > 0
                ? rawRecipient
                : undefined,
            metadata: transaction.metadata,
          },
        )
      : [];
  const isBillPayment = transaction.type === "bill_payment";

  return (
    <Screen>
      <View style={styles.container}>
        {/* Receipt — captured as the shared image */}
        <View ref={receiptRef} collapsable={false} style={styles.receipt}>
          {/* Sm@rtAjo header */}
          <View style={styles.brandRow}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>A</Text>
            </View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandName}>Sm@rtAjo</Text>
              <Text style={styles.brandTagline}>Save Together, Grow Together</Text>
            </View>
          </View>
          <View style={styles.accentRule} />

          <Text style={styles.receiptTitle}>Transaction Receipt</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusBackground }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {transaction.status === "pending"
                ? "PENDING"
                : transaction.status === "failed"
                  ? "FAILED"
                  : "SUCCESSFUL"}
            </Text>
          </View>

          {isBillPayment ? (
            billRows.map((row) => (
              <View key={row.label} style={styles.detailRow}>
                <Text style={styles.label}>{row.label}</Text>
                <Text style={styles.value}>{row.value}</Text>
              </View>
            ))
          ) : (
            <View style={styles.detailRow}>
              <Text style={styles.label}>Type</Text>
              <Text style={styles.value}>{typeLabel(transaction.type, billDetail)}</Text>
            </View>
          )}
          <View style={styles.amountRow}>
            <Text style={styles.label}>Amount</Text>
            <Text style={[styles.amount, { color: isCredit ? colors.success : colors.ink }]}>
              {isCredit ? "+" : "−"}
              {formatNaira(transaction.amount)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Reference</Text>
            <Text style={styles.value}>{transaction.reference}</Text>
          </View>
          {externalReference ? (
            <View style={styles.detailRow}>
              <Text style={styles.label}>External Ref</Text>
              <Text style={styles.value}>{externalReference}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.label}>Balance after</Text>
            <Text style={styles.value}>{formatNaira(transaction.balanceAfter)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatDate(transaction.createdAt)}</Text>
          </View>
        </View>

        <Button
          title={sharing ? "Preparing..." : "Share Receipt"}
          onPress={handleShare}
          loading={sharing}
          style={styles.button}
        />
        <Button
          title="Done"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "stretch",
    justifyContent: "center",
  },
  receipt: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  logoText: {
    fontSize: 30,
    fontWeight: typography.weights.bold,
    color: colors.white,
    lineHeight: 34,
  },
  brandTextWrap: {
    flex: 1,
  },
  brandName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.inkSoft,
    marginTop: 2,
  },
  accentRule: {
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginBottom: spacing.lg,
  },
  receiptTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  statusBadge: {
    alignSelf: "center",
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    letterSpacing: 1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
    marginRight: spacing.md,
  },
  value: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
    textAlign: "right",
    flexShrink: 1,
  },
  amount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  button: {
    width: "100%",
    marginBottom: spacing.md,
  },
});