import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ApiError } from "../../api/api-error";
import { activateGroup } from "../../api/cycles";
import { colors, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<GroupsStackParamList, "ActivateGroup">;

export function ActivateGroupScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activated, setActivated] = useState(false);

  async function handleActivate() {
    setLoading(true);
    setError(null);
    try {
      await activateGroup(groupId);
      setActivated(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to activate group. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  if (activated) {
    return (
      <Screen>
        <View style={styles.successContainer}>
          <Text style={styles.successTitle}>Group Activated! 🎉</Text>
          <Text style={styles.successText}>
            Your group is now active. Cycle 1 has been created and members can start contributing.
          </Text>
          <Button
            title="View Current Cycle"
            onPress={() => navigation.replace("CurrentCycle", { groupId })}
          />
          <Button
            title="Back to Group"
            variant="secondary"
            onPress={() => navigation.replace("GroupDetail", { groupId })}
            style={styles.secondaryButton}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>Activate Group</Text>
      <Text style={styles.subtitle}>
        Activating this group will create the first contribution cycle and enable members
        {`to start contributing. Each member will get a wallet if they don't already have one.`}
      </Text>

      {error && <ErrorBanner message={error} />}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>What happens next:</Text>
        <Text style={styles.bullet}>{"\u2022"} Cycle 1 is created immediately</Text>
        <Text style={styles.bullet}>{"\u2022"} A due date is set based on the group frequency</Text>
        <Text style={styles.bullet}>{"\u2022"} Members fund their wallets and contribute</Text>
        <Text style={styles.bullet}>{"\u2022"} Once all contributions are in, payout can proceed</Text>
      </View>

      <Button
        title="Activate Group"
        onPress={handleActivate}
        loading={loading}
        style={styles.activateButton}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  infoTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  bullet: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
    lineHeight: 24,
  },
  activateButton: {
    marginTop: spacing.lg,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.success,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  successText: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
    textAlign: "center",
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  secondaryButton: {
    marginTop: spacing.sm,
  },
});