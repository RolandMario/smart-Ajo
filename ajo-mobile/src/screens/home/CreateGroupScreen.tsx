import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ApiError } from "../../api/api-error";
import { createGroup } from "../../api/groups";
import type { ContributionFrequency, RotationMethod } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<GroupsStackParamList, "CreateGroup">;

const FREQUENCIES: { label: string; value: ContributionFrequency }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

const ROTATION_METHODS: { label: string; value: RotationMethod }[] = [
  { label: "Random", value: "random" },
  { label: "Manual", value: "manual" },
];

export function CreateGroupScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [totalSlots, setTotalSlots] = useState("");
  const [frequency, setFrequency] = useState<ContributionFrequency>("monthly");
  const [rotationMethod, setRotationMethod] = useState<RotationMethod>("random");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const amountNum = parseInt(amount, 10);
    const slotsNum = parseInt(totalSlots, 10);

    if (!name || name.length < 2) {
      setError("Group name must be at least 2 characters.");
      return;
    }
    if (!amountNum || amountNum < 1) {
      setError("Enter a valid contribution amount.");
      return;
    }
    if (!slotsNum || slotsNum < 2 || slotsNum > 200) {
      setError("Number of slots must be between 2 and 200.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await createGroup({
        name,
        contributionAmount: amountNum,
        frequency,
        totalSlots: slotsNum,
        rotationMethod,
      });
      navigation.replace("GroupDetail", { groupId: result.group._id });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create group. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Create a Group</Text>
      <Text style={styles.subtitle}>
        {`Set up your savings group. You'll be the group admin.`}
      </Text>

      {error && <ErrorBanner message={error} />}

      <TextField
        label="Group name"
        placeholder="e.g. Family Savings"
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <TextField
        label="Contribution amount (₦)"
        placeholder="e.g. 5000"
        keyboardType="number-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <TextField
        label="Number of members (including you)"
        placeholder="e.g. 10"
        keyboardType="number-pad"
        value={totalSlots}
        onChangeText={setTotalSlots}
      />

      <Text style={styles.sectionLabel}>Contribution frequency</Text>
      <View style={styles.optionRow}>
        {FREQUENCIES.map((f) => (
          <Pressable
            key={f.value}
            style={[
              styles.option,
              frequency === f.value && styles.optionSelected,
            ]}
            onPress={() => setFrequency(f.value)}
          >
            <Text
              style={[
                styles.optionText,
                frequency === f.value && styles.optionTextSelected,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Payout order method</Text>
      <View style={styles.optionRow}>
        {ROTATION_METHODS.map((r) => (
          <Pressable
            key={r.value}
            style={[
              styles.option,
              rotationMethod === r.value && styles.optionSelected,
            ]}
            onPress={() => setRotationMethod(r.value)}
          >
            <Text
              style={[
                styles.optionText,
                rotationMethod === r.value && styles.optionTextSelected,
              ]}
            >
              {r.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {rotationMethod === "random" && (
        <Text style={styles.helperText}>
          Payout order will be randomly shuffled once all members have joined.
        </Text>
      )}
      {rotationMethod === "manual" && (
        <Text style={styles.helperText}>
          {`You'll set the payout order manually after all members have joined.`}
        </Text>
      )}

      <Button
        title="Create Group"
        onPress={handleCreate}
        loading={loading}
        style={styles.createButton}
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
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.inkSoft,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  optionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  option: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    backgroundColor: colors.surface,
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  optionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.inkSoft,
  },
  optionTextSelected: {
    color: colors.primary,
  },
  helperText: {
    fontSize: typography.sizes.xs,
    color: colors.inkFaint,
    marginBottom: spacing.lg,
    fontStyle: "italic",
  },
  createButton: {
    marginTop: spacing.lg,
  },
});