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

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
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
  ({ label, error, helperText, secureTextEntry, secureToggle = false, action, style, ...props }, ref) => {
    const [revealed, setRevealed] = useState(false);
    const showToggle = Boolean(secureTextEntry && secureToggle);

    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={[styles.inputWrap, error && styles.inputError]}>
          <TextInput
            ref={ref}
            style={[styles.input, style]}
            placeholderTextColor={colors.inkFaint}
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
              <Ionicons name={action.icon} size={20} color={colors.primary} />
            </Pressable>
          ) : null}
          {showToggle ? (
            <TouchableOpacity
              onPress={() => setRevealed((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={revealed ? "Hide password" : "Show password"}
              style={styles.toggleButton}
            >
              <Ionicons
                name={revealed ? "eye-off" : "eye"}
                size={20}
                color={colors.inkSoft}
              />
            </TouchableOpacity>
          ) : null}
        </View>
        {error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : helperText ? (
          <Text style={styles.helperText}>{helperText}</Text>
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
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceSunken,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    fontSize: typography.sizes.base,
    color: colors.ink,
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
    backgroundColor: colors.primarySoft,
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
    color: colors.inkFaint,
  },
});
