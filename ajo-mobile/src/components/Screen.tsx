import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "../theme";

interface ScreenProps {
  children: React.ReactNode;
  /** Wrap content in a ScrollView — turn off for screens with their own scrollable list (e.g. FlatList). */
  scrollable?: boolean;
  style?: ViewStyle;
  /**
   * Page background, including the safe areas. Defaults to the pale
   * forest canvas (`colors.forestLightCanvas`); pass an explicit token
   * for the full-bleed dark `colors.forest` hero surfaces.
   */
  backgroundColor?: string;
}

export function Screen({
  children,
  scrollable = true,
  style,
  backgroundColor = colors.forestLightCanvas,
}: ScreenProps) {
  const content = scrollable ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, style]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, style]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {content}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.forestLightCanvas,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  content: {
    flex: 1,
    padding: spacing.xl,
  },
});
