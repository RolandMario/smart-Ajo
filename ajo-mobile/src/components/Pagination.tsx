import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme";

interface PaginationProps {
  /** Current page, 1-based. */
  page: number;
  /** Total number of pages (>= 1). */
  pageCount: number;
  /** Called with the page the member wants to see. */
  onChange: (page: number) => void;
  /** Rows across all pages — enables the "1–10 of 23" caption. */
  total?: number;
  /** Rows per page — pairs with `total` for the caption. */
  pageSize?: number;
  /** Disables the arrows while a page is being fetched. */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Prev / Next pager used under paginated lists ("Page 1 of 3").
 *
 * Renders nothing when there is a single page, so callers can drop it in
 * unconditionally.
 */
export function Pagination({
  page,
  pageCount,
  onChange,
  total,
  pageSize,
  loading = false,
  style,
}: PaginationProps) {
  if (pageCount <= 1) return null;

  const atStart = page <= 1;
  const atEnd = page >= pageCount;
  const showRange = total !== undefined && pageSize !== undefined && total > 0;
  const rangeStart = showRange ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = showRange ? Math.min(page * pageSize, total) : 0;

  return (
    <View style={[styles.row, style]}>
      <PagerButton
        label="Prev"
        icon="chevron-back"
        disabled={atStart || loading}
        onPress={() => onChange(page - 1)}
      />
      <View style={styles.center}>
        <Text style={styles.pageLabel}>
          Page {page} of {pageCount}
        </Text>
        {showRange && (
          <Text style={styles.rangeLabel}>
            {`${rangeStart}–${rangeEnd} of ${total}`}
          </Text>
        )}
      </View>
      <PagerButton
        label="Next"
        icon="chevron-forward"
        iconAfter
        disabled={atEnd || loading}
        onPress={() => onChange(page + 1)}
      />
    </View>
  );
}

function PagerButton({
  label,
  icon,
  iconAfter = false,
  disabled,
  onPress,
}: {
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconAfter?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const tint = disabled ? colors.forestLightInkFaint : colors.forestAction;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} page`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}
    >
      {!iconAfter && <Ionicons name={icon} size={16} color={tint} />}
      <Text style={[styles.buttonLabel, disabled && styles.buttonLabelDisabled]}>
        {label}
      </Text>
      {iconAfter && <Ionicons name={icon} size={16} color={tint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  center: {
    alignItems: "center",
    flex: 1,
  },
  pageLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInk,
  },
  rangeLabel: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    marginTop: 2,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    backgroundColor: colors.white,
  },
  buttonDisabled: {
    backgroundColor: colors.forestLightCanvas,
    borderColor: colors.forestLightLine,
  },
  buttonPressed: {
    backgroundColor: colors.forestLightPill,
  },
  buttonLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestAction,
  },
  buttonLabelDisabled: {
    color: colors.forestLightInkFaint,
  },
});
