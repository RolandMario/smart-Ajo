import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { colors, spacing, typography } from "../../theme";

/**
 * Placeholder for Sub-phase B (Groups: browse, create, invite, join).
 * Exists now purely so the authenticated tab shell has something to
 * show and the navigation structure is exercised end-to-end in
 * Sub-phase A.
 */
export function GroupsScreen() {
  return (
    <Screen scrollable={false}>
      <View style={styles.center}>
        <Text style={styles.title}>Your groups</Text>
        <Text style={styles.subtitle}>
          Group browsing, creation, and invites are coming in the next sub-phase.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
    textAlign: "center",
    lineHeight: 22,
  },
});
