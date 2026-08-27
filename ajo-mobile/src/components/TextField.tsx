import React, { forwardRef, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radii, spacing, typography } from "../theme";

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  /** Show a show/hide toggle on the right side of a secure (password) field. */
  secureToggle?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(
  ({ label, error, helperText, secureTextEntry, secureToggle = false, style, ...props }, ref) => {
    const [revealed, setRevealed] = useState(false);
    const showToggle = Boolean(secureTextEntry && secureToggle);

    return (
      <View style={styles.container}>
        {label && <Text style={styles.label}>{label}</Text>}
        <View style={styles.inputWrap}>
          <TextInput
            ref={ref}
            style={[styles.input, error && styles.inputError, style]}
            placeholderTextColor={colors.inkFaint}
            secureTextEntry={secureTextEntry && !revealed}
            {...props}
          />
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
  },
  input: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: spacing.lg,
    fontSize: typography.sizes.base,
    color: colors.ink,
  },
  toggleButton: {
    minHeight: 52,
    paddingHorizontal: spacing.md,
    alignItems: "center",
    justifyContent: "center",
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
