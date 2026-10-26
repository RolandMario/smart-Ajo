import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme";

interface SubpageHeaderProps {
  /** The circle's name, set in the serif headline. */
  title: string;
  /** Small muted line under it — round, due date, member count, … */
  subtitle?: string;
  onBack: () => void;
  /** Optional trailing node pinned to the right edge of the row (e.g. a Manage action). */
  right?: ReactNode;
}

/**
 * Light-surface subpage header used by the cycle screens: a circular back
 * chip beside a serif title and a muted subtitle, matching the mock's light
 * forest canvas. Screens that draw their own header declare
 * `options={{ headerShown: false }}` in MainNavigator.
 */
export function SubpageHeader({
  title,
  subtitle,
  onBack,
  right,
}: SubpageHeaderProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Ionicons name="chevron-back" size={20} color={colors.forestLightInk} />
      </Pressable>

      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.forestLightPill,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.7,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: 2,
  },
});