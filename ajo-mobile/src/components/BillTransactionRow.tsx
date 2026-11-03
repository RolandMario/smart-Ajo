import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BillServiceType, BillTransaction } from "../types/api";
import { colors, radii, spacing, typography } from "../theme";
import { formatNaira, formatRelativeTime } from "../utils/format";

/** Display metadata for each bill service — shared by the Bills home tiles and
 * the history rows so a service keeps the same icon and tint everywhere. */
export interface BillServiceMeta {
  label: string;
  caption: string;
  icon: keyof typeof Ionicons.glyphMap;
  background: string;
  foreground: string;
}

export const BILL_SERVICE_META: Record<BillServiceType, BillServiceMeta> = {
  airtime: {
    label: "Airtime",
    caption: "Buy airtime for any network",
    icon: "phone-portrait-outline",
    background: colors.forestLightPill,
    foreground: colors.forestAction,
  },
  data: {
    label: "Data",
    caption: "Purchase data bundles",
    icon: "globe-outline",
    background: colors.successSoft,
    foreground: colors.success,
  },
  cable: {
    label: "Cable TV",
    caption: "DSTV, GOtv, StarTimes",
    icon: "tv-outline",
    background: colors.warningSoft,
    foreground: colors.warning,
  },
  electricity: {
    label: "Electricity",
    caption: "Prepaid & postpaid bills",
    icon: "flash-outline",
    background: colors.dangerSoft,
    foreground: colors.danger,
  },
};

/** Soft pill tones for a receipt status. */
const STATUS_TONES: Record<
  string,
  { label: string; background: string; foreground: string }
> = {
  success: {
    label: "Successful",
    background: colors.successSoft,
    foreground: colors.success,
  },
  pending: {
    label: "Pending",
    background: colors.warningSoft,
    foreground: colors.warning,
  },
  failed: {
    label: "Failed",
    background: colors.dangerSoft,
    foreground: colors.danger,
  },
};

const FALLBACK_TONE = {
  label: "Processing",
  background: colors.forestLightCard,
  foreground: colors.forestLightInkSoft,
};

/** "0803 123 4567 · 2d ago" — skips either half when the API omits it. */
function billSubtitle(transaction: BillTransaction): string {
  return [transaction.recipient, formatRelativeTime(transaction.createdAt)]
    .filter((part) => part.length > 0)
    .join(" · ");
}

interface BillTransactionRowProps {
  transaction: BillTransaction;
  onPress: () => void;
}

/**
 * One bill payment in the history list: tinted service icon, service name,
 * recipient + relative time, the amount and a soft status pill. Mirrors the
 * transaction rows used elsewhere in the app (white card on the pale canvas)
 * while giving each service its own colour cue.
 */
export function BillTransactionRow({
  transaction,
  onPress,
}: BillTransactionRowProps) {
  const service = BILL_SERVICE_META[transaction.type] ?? BILL_SERVICE_META.airtime;
  const status = STATUS_TONES[transaction.status] ?? FALLBACK_TONE;
  const subtitle = billSubtitle(transaction);

  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${service.label} ${formatNaira(transaction.amount)}, ${status.label}. View receipt`}
    >
      <View style={[styles.icon, { backgroundColor: service.background }]}>
        <Ionicons name={service.icon} size={20} color={service.foreground} />
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {service.label}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.amountBlock}>
        <Text style={styles.amount} numberOfLines={1}>
          {formatNaira(transaction.amount)}
        </Text>
        <View style={[styles.statusPill, { backgroundColor: status.background }]}>
          <Text style={[styles.statusText, { color: status.foreground }]}>
            {status.label}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowPressed: {
    opacity: 0.7,
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.md,
    marginRight: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  subtitle: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    marginTop: 2,
  },
  amountBlock: {
    alignItems: "flex-end",
  },
  amount: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  statusPill: {
    borderRadius: radii.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: spacing.xs,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
});
