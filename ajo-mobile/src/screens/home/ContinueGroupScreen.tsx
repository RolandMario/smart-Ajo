import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { getGroupDetail, continueGroup } from "../../api/groups";
import type { GroupDetail, ContributionFrequency } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira } from "../../utils/format";

type Props = NativeStackScreenProps<GroupsStackParamList, "ContinueGroup">;

const FREQUENCY_OPTIONS: { label: string; value: ContributionFrequency }[] = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
];

export function ContinueGroupScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields — pre-filled from current group
  const [contributionAmount, setContributionAmount] = useState("");
  const [frequency, setFrequency] = useState<ContributionFrequency>("monthly");
  const [totalSlots, setTotalSlots] = useState("");

  useFocusEffect(
    useCallback(() => {
      async function fetchData() {
        try {
          const result = await getGroupDetail(groupId);
          setDetail(result);
          setContributionAmount(String(result.group.contributionAmount));
          setFrequency(result.group.frequency);
          setTotalSlots(String(result.group.totalSlots));
          setError(null);
        } catch (err) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("Failed to load group details");
          }
        } finally {
          setLoading(false);
        }
      }
      fetchData();
    }, [groupId]),
  );

  async function handleContinue() {
    if (!detail) return;

    const amount = parseInt(contributionAmount, 10);
    const slots = parseInt(totalSlots, 10);

    if (isNaN(amount) || amount < 1) {
      setError("Contribution amount must be at least 1");
      return;
    }
    if (isNaN(slots) || slots < 2) {
      setError("Total slots must be at least 2");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await continueGroup(groupId, {
        contributionAmount: amount !== detail.group.contributionAmount ? amount : undefined,
        frequency: frequency !== detail.group.frequency ? frequency : undefined,
        totalSlots: slots !== detail.group.totalSlots ? slots : undefined,
      });
      navigation.replace("CurrentCycle", { groupId });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to continue group");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (!detail) {
    return (
      <Screen>
        <Text style={styles.title}>Continue Group</Text>
        {error && <ErrorBanner message={error} />}
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView>
        <Text style={styles.title}>Continue Group</Text>
        <Text style={styles.subtitle}>
          Start a new round for "{detail.group.name}". Adjust settings below or
          keep the current values.
        </Text>

        {error && <ErrorBanner message={error} />}

        <View style={styles.formCard}>
          <Text style={styles.fieldLabel}>Contribution Amount (₦)</Text>
          <TextInput
            style={styles.input}
            value={contributionAmount}
            onChangeText={setContributionAmount}
            keyboardType="number-pad"
            placeholder="e.g. 5000"
          />

          <Text style={styles.fieldLabel}>Frequency</Text>
          <View style={styles.frequencyRow}>
            {FREQUENCY_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                title={opt.label}
                variant={frequency === opt.value ? "primary" : "secondary"}
                onPress={() => setFrequency(opt.value)}
                style={styles.frequencyButton}
              />
            ))}
          </View>

          <Text style={styles.fieldLabel}>Total Slots</Text>
          <TextInput
            style={styles.input}
            value={totalSlots}
            onChangeText={setTotalSlots}
            keyboardType="number-pad"
            placeholder="e.g. 5"
          />

          <Text style={styles.note}>
            Current values: {formatNaira(detail.group.contributionAmount)} /{" "}
            {detail.group.frequency} · {detail.group.totalSlots} slots
          </Text>
        </View>

        <Button
          title="Start New Round"
          onPress={handleContinue}
          loading={saving}
          style={styles.actionButton}
        />

        <Button
          title="Cancel"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={styles.cancelButton}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.ink,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.ink,
  },
  frequencyRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  frequencyButton: {
    flex: 1,
  },
  note: {
    fontSize: typography.sizes.xs,
    color: colors.inkSoft,
    marginTop: spacing.md,
    fontStyle: "italic",
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
  cancelButton: {
    marginBottom: spacing.xl,
  },
});