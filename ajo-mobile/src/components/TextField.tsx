import React, { forwardRef, useState, type ComponentProps } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme";

/** The exact literal-union of valid Ionicon glyph names. */
type IoniconName = ComponentProps<typeof Ionicons>["name"];

type TextFieldVariant = "default" | "light";

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  /**
   * Surface the field sits on. `default` is the standard field on the
   * pale forest canvas; `light` is the taller sign-in treatment with a
   * green-wash fill and a "Show"/"Hide" text toggle in place of the eye
   * glyph.
   */
  variant?: TextFieldVariant;
  /** Show a show/hide toggle on the right side of a secure (password) field. */
  secureToggle?: boolean;
  /**
   * Optional icon action rendered on the right side of the input row (e.g. a
   * contacts "person" icon that opens the device address book). Same
   * placement as the secure toggle.
   */
  action?: {
    icon: IoniconName;
    accessibilityLabel: string;
    onPress: () => void;
  };
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  (
    {
      label,
      error,
      helperText,
      variant = "default",
      secureTextEntry,
      secureToggle = false,
      action,
      style,
      ...props
    },
    ref,
  ) => {
    const [revealed, setRevealed] = useState(false);
    const showToggle = Boolean(secureTextEntry && secureToggle);
    const isLight = variant === "light";

    return (
      <View style={[styles.container, isLight && styles.containerLight]}>
        {label && <Text style={[styles.label, isLight && styles.labelLight]}>{label}</Text>}
        <View
          style={[styles.inputWrap, isLight && styles.inputWrapLight, error && styles.inputError]}
        >
          <TextInput
            ref={ref}
            style={[styles.input, isLight && styles.inputLight, style]}
            placeholderTextColor={isLight ? colors.forestLightInkFaint : colors.forestLightInkFaint}
            secureTextEntry={secureTextEntry && !revealed}
            {...props}
          />
          {action ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={action.accessibilityLabel}
              onPress={action.onPress}
              style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name={action.icon} size={20} color={colors.forestAction} />
            </Pressable>
          ) : null}
          {showToggle ? (
            <TouchableOpacity
              onPress={() => setRevealed((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={revealed ? "Hide password" : "Show password"}
              style={isLight ? styles.toggleLabelButton : styles.toggleButton}
            >
              {isLight ? (
                <Text style={styles.toggleLabel}>{revealed ? "Hide" : "Show"}</Text>
              ) : (
                <Ionicons
                  name={revealed ? "eye-off" : "eye"}
                  size={20}
                  color={colors.forestLightInkSoft}
                />
              )}
            </TouchableOpacity>
          ) : null}
        </View>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : helperText ? (
          <Text style={[styles.helperText, isLight && styles.helperTextLight]}>{helperText}</Text>
        ) : null}
      </View>
    );
  },
);

TextField.displayName = "TextField";

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.xs,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    backgroundColor: colors.forestLightField,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    fontSize: typography.sizes.base,
    color: colors.forestLightInk,
    // The container renders the field background; keep the raw input
    // transparent so the OS never paints a default background over it.
    backgroundColor: "transparent",
  },
  toggleButton: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.forestLightPill,
    marginLeft: spacing.xs,
  },
  inputError: {
    borderColor: colors.danger,
  },
  errorText: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.xs,
    color: colors.danger,
  },
  helperText: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
  },
  // --- Light (pale forest) surface ----------------------------------
  // Same control, restyled for the light auth screens: taller, rounder,
  // a green-wash fill, larger type, and a text toggle.
  containerLight: {
    marginBottom: spacing.xxl,
  },
  labelLight: {
    fontSize: typography.sizes.base,
    marginBottom: spacing.sm,
    color: colors.forestLightInkSoft,
  },
  inputWrapLight: {
    minHeight: 64,
    borderRadius: radii.lg,
    backgroundColor: colors.forestLightField,
    borderColor: colors.forestLightLine,
  },
  inputLight: {
    minHeight: 64,
    paddingHorizontal: spacing.xl,
    fontSize: typography.sizes.lg,
    color: colors.forestLightInk,
  },
  toggleLabelButton: {
    minHeight: 64,
    paddingHorizontal: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestAction,
  },
  helperTextLight: {
    color: colors.forestLightInkFaint,
  },
});
