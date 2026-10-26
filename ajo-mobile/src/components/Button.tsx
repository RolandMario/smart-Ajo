import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "gold"
  | "outline"
  | "forest"
  | "outlineLight"
  | "danger";

/** The exact literal-union of valid Ionicon glyph names. */
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

interface ButtonProps extends Omit<PressableProps, "style"> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /** Optional leading glyph, tinted with the label colour for the variant. */
  icon?: IoniconName;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  variant = "primary",
  loading = false,
  icon,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        variantStyles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={labelColors[variant]} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={20} color={labelColors[variant]} /> : null}
          <Text style={[styles.label, { color: labelColors[variant] }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
});

const variantStyles: Record<ButtonVariant, ViewStyle> = StyleSheet.create({
  primary: {
    backgroundColor: colors.forestAction,
  },
  secondary: {
    backgroundColor: colors.forestLightPill,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  gold: {
    backgroundColor: colors.gold,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.forestLine,
  },
  forest: {
    backgroundColor: colors.forestAction,
  },
  outlineLight: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.forestLightLine,
  },
  danger: {
    backgroundColor: colors.danger,
  },
});

/** Label (and spinner) colour for each variant. */
const labelColors: Record<ButtonVariant, string> = {
  primary: colors.white,
  secondary: colors.forestAction,
  ghost: colors.forestAction,
  gold: colors.onGold,
  outline: colors.onForest,
  forest: colors.white,
  outlineLight: colors.forestAction,
  danger: colors.white,
};
