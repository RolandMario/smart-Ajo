import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DonationsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ApiError } from "../../api/api-error";
import { createDonationGroup } from "../../api/donations";
import type {
  DonationAmountType,
  DonationFrequency,
  DonationSchedule,
} from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatDonationCadence, formatNaira } from "../../utils/format";

type Props = NativeStackScreenProps<
  DonationsStackParamList,
  "CreateDonationGroup"
>;

/** Mirrors the server's DONATION_MIN_AMOUNT so users get instant feedback. */
const MIN_AMOUNT = 100;

const AMOUNT_TYPES: {
  label: string;
  hint: string;
  value: DonationAmountType;
}[] = [
  {
    label: "Fixed amount",
    hint: "Everyone gives the same amount",
    value: "fixed",
  },
  {
    label: "Free will",
    hint: "Donors choose how much to give",
    value: "free_will",
  },
];

const SCHEDULES: { label: string; hint: string; value: DonationSchedule }[] = [
  {
    label: "One-time",
    hint: "Each member can donate once",
    value: "one_time",
  },
  {
    label: "Recurring",
    hint: "One donation per member per period",
    value: "interval",
  },
];

const FREQUENCIES: { label: string; value: DonationFrequency }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

/**
 * Creates a pool collection. Fixed pools must have an amount; recurring pools
 * must pick a cadence — the same rules the server enforces.
 */
export function CreateDonationGroupScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [amountType, setAmountType] = useState<DonationAmountType>("fixed");
  const [amount, setAmount] = useState("");
  const [schedule, setSchedule] = useState<DonationSchedule>("one_time");
  const [frequency, setFrequency] = useState<DonationFrequency>("monthly");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const amountNum = parseInt(amount, 10);

  async function handleCreate() {
    if (!name.trim() || name.trim().length < 2) {
      setError("Give your pool a name (at least 2 characters).");
      return;
    }
    if (!purpose.trim() || purpose.trim().length < 5) {
      setError("Describe what the pool is for (at least 5 characters).");
      return;
    }
    if (amountType === "fixed" && (!amountNum || amountNum < MIN_AMOUNT)) {
      setError(
        `Enter the donation amount — at least ${formatNaira(MIN_AMOUNT)}.`,
      );
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const result = await createDonationGroup({
        name: name.trim(),
        purpose: purpose.trim(),
        amountType,
        amount: amountType === "fixed" ? amountNum : undefined,
        schedule,
        frequency: schedule === "interval" ? frequency : undefined,
      });
      navigation.replace("DonationGroupDetail", {
        groupId: result.group._id,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create the pool. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Create a Pool</Text>
      <Text style={styles.subtitle}>
        Members donate from their Ajo wallet into the pool. You can pay the
        collected money out to your bank account whenever you like.
      </Text>

      {error && <ErrorBanner message={error} />}

      <TextField
        label="Pool name"
        placeholder="e.g. Chidi's Wedding Fund"
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <TextField
        label="What is it for?"
        placeholder="e.g. Help Chidi celebrate his wedding"
        value={purpose}
        onChangeText={setPurpose}
        multiline
      />

      <Text style={styles.sectionLabel}>Donation amount</Text>
      <View style={styles.optionColumn}>
        {AMOUNT_TYPES.map((option) => {
          const active = amountType === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.optionCard, active && styles.optionCardActive]}
              onPress={() => setAmountType(option.value)}
            >
              <Text
                style={[styles.optionTitle, active && styles.optionTitleActive]}
              >
                {option.label}
              </Text>
              <Text style={styles.optionHint}>{option.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      {amountType === "fixed" && (
        <TextField
          label="Amount per donation (₦)"
          placeholder={`e.g. 1000 (minimum ${MIN_AMOUNT})`}
          keyboardType="number-pad"
          value={amount}
          onChangeText={setAmount}
        />
      )}

      <Text style={styles.sectionLabel}>How often can members give?</Text>
      <View style={styles.optionColumn}>
        {SCHEDULES.map((option) => {
          const active = schedule === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.optionCard, active && styles.optionCardActive]}
              onPress={() => setSchedule(option.value)}
            >
              <Text
                style={[styles.optionTitle, active && styles.optionTitleActive]}
              >
                {option.label}
              </Text>
              <Text style={styles.optionHint}>{option.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      {schedule === "interval" && (
        <View style={styles.chipWrap}>
          {FREQUENCIES.map((f) => {
            const active = frequency === f.value;
            return (
              <Pressable
                key={f.value}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFrequency(f.value)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>What donors will see</Text>
        <Text style={styles.summaryText}>
          {amountType === "fixed"
            ? `${
                amountNum >= MIN_AMOUNT
                  ? formatNaira(amountNum)
                  : `At least ${formatNaira(MIN_AMOUNT)}`
              } per donation`
            : "Any amount"}
          {" · "}
          {formatDonationCadence(
            schedule,
            schedule === "interval" ? frequency : undefined,
          ).toLowerCase()}
        </Text>
        <Text style={styles.summaryNote}>
          Donations are final once made — the money stays in the pool until you
          pay it out.
        </Text>
      </View>

      <Button
        title="Create Pool"
        onPress={handleCreate}
        loading={loading}
        icon="gift-outline"
      />
    </Screen>
  );
}


const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.sm,
  },
  optionColumn: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  optionCardActive: {
    borderColor: colors.forestAction,
    backgroundColor: colors.forestLightPill,
  },
  optionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  optionTitleActive: {
    color: colors.forestAction,
  },
  optionHint: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    marginTop: 2,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    backgroundColor: colors.white,
  },
  chipActive: {
    borderColor: colors.forestAction,
    backgroundColor: colors.forestLightPill,
  },
  chipText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  chipTextActive: {
    color: colors.forestAction,
    fontWeight: typography.weights.medium,
  },
  summary: {
    backgroundColor: colors.forestLightCard,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  summaryText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  summaryNote: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    marginTop: spacing.xs,
    lineHeight: 16,
  },
});

