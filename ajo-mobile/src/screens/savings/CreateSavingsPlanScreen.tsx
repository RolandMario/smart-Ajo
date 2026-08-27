import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { WalletStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ApiError } from "../../api/api-error";
import { createSavingPlan } from "../../api/savings";
import type {
  ContributionFrequency,
  SavingDurationUnit,
} from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatDuration, formatNaira } from "../../utils/format";

type Props = NativeStackScreenProps<WalletStackParamList, "CreateSavingsPlan">;

const FREQUENCIES: { label: string; value: ContributionFrequency }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

const DURATION_UNITS: { label: string; value: SavingDurationUnit }[] = [
  { label: "Days", value: "days" },
  { label: "Months", value: "months" },
  { label: "Years", value: "years" },
];

const DURATION_PRESETS: Record<SavingDurationUnit, number[]> = {
  days: [7, 14, 30, 60, 90, 365],
  months: [1, 2, 3, 6, 12],
  years: [1, 2, 3, 5],
};

/** Mirrors the server-side caps so users get immediate feedback. */
const DURATION_LIMITS: Record<SavingDurationUnit, number> = {
  days: 365,
  months: 120,
  years: 10,
};

export function CreateSavingsPlanScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<ContributionFrequency>("monthly");
  const [durationUnit, setDurationUnit] = useState<SavingDurationUnit>("months");
  const [durationValue, setDurationValue] = useState<number>(6);
  const [customActive, setCustomActive] = useState(false);
  const [customText, setCustomText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCreate() {
    const amountNum = parseInt(amount, 10);
    const selectedDuration = customActive
      ? parseInt(customText, 10)
      : durationValue;

    if (!name || name.trim().length < 2) {
      setError("Give your savings plan a purpose (at least 2 characters).");
      return;
    }
    if (!amountNum || amountNum < 1) {
      setError("Enter a valid amount to save per interval.");
      return;
    }
    if (!selectedDuration || selectedDuration < 1) {
      setError("Enter how long you want to save for (at least 1).");
      return;
    }
    if (selectedDuration > DURATION_LIMITS[durationUnit]) {
      setError(
        `Duration is too long. Maximum is ${DURATION_LIMITS[durationUnit]} ${durationUnit}.`,
      );
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await createSavingPlan({
        name: name.trim(),
        amount: amountNum,
        frequency,
        durationUnit,
        durationValue: selectedDuration,
      });
      navigation.replace("SavingsPlanDetail", { planId: result.plan._id });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create savings plan. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function selectPreset(value: number) {
    setDurationValue(value);
    setCustomActive(false);
    setCustomText("");
  }

  const previewAmount = parseInt(amount, 10) || 0;
  const previewDuration = customActive
    ? parseInt(customText, 10)
    : durationValue;
  const showSummary = previewAmount >= 1 && previewDuration >= 1;

  return (
    <Screen>
      <Text style={styles.title}>Create a Savings Plan</Text>
      <Text style={styles.subtitle}>
        Ajo will automatically move your chosen amount into this plan at each
        interval. When the cycle finishes, you can withdraw it to your bank.
      </Text>

      {error && <ErrorBanner message={error} />}

      <TextField
        label="Purpose (plan name)"
        placeholder="e.g. House rent"
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <TextField
        label="Amount to save per interval (₦)"
        placeholder="e.g. 5000"
        keyboardType="number-pad"
        value={amount}
        onChangeText={setAmount}
      />

      <Text style={styles.sectionLabel}>How often to save</Text>
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

      <Text style={styles.sectionLabel}>For how long</Text>
      <View style={styles.optionRow}>
        {DURATION_UNITS.map((u) => (
          <Pressable
            key={u.value}
            style={[
              styles.option,
              durationUnit === u.value && styles.optionSelected,
            ]}
            onPress={() => setDurationUnit(u.value)}
          >
            <Text
              style={[
                styles.optionText,
                durationUnit === u.value && styles.optionTextSelected,
              ]}
            >
              {u.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.chipWrap}>
        {DURATION_PRESETS[durationUnit].map((n) => {
          const active = !customActive && durationValue === n;
          return (
            <Pressable
              key={n}
              style={[styles.chip, active && styles.chipSelected]}
              onPress={() => selectPreset(n)}
            >
              <Text
                style={[styles.chipText, active && styles.chipTextSelected]}
              >
                {n}
              </Text>
            </Pressable>
          );
        })}
        <Pressable
          style={[styles.chip, customActive && styles.chipSelected]}
          onPress={() => setCustomActive(true)}
        >
          <Text
            style={[styles.chipText, customActive && styles.chipTextSelected]}
          >
            Custom
          </Text>
        </Pressable>
      </View>

      {customActive && (
        <TextField
          label={`How many ${durationUnit}?`}
          placeholder={
            durationUnit === "days"
              ? "e.g. 20"
              : durationUnit === "months"
                ? "e.g. 2"
                : "e.g. 1"
          }
          keyboardType="number-pad"
          value={customText}
          onChangeText={setCustomText}
          helperText={`Up to ${DURATION_LIMITS[durationUnit]} ${durationUnit}.`}
        />
      )}

      {showSummary && (
        <Text style={styles.summaryText}>
          Save {formatNaira(previewAmount)} {frequency} for{" "}
          {formatDuration(durationUnit, previewDuration)}
        </Text>
      )}

      <Button
        title="Start Savings Plan"
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
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: "center",
  },
  chipSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.inkSoft,
  },
  chipTextSelected: {
    color: colors.primary,
  },
  summaryText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  createButton: {
    marginTop: spacing.lg,
  },
});
