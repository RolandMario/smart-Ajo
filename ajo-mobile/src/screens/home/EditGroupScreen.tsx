import React, { useState, useEffect } from "react";
import {
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
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { getGroupDetail, updateGroup } from "../../api/groups";
import type { Group, GroupMember } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira } from "../../utils/format";

type Props = NativeStackScreenProps<GroupsStackParamList, "EditGroup">;

const FREQUENCIES = [
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
] as const;

export function EditGroupScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [totalSlots, setTotalSlots] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("monthly");

  useEffect(() => {
    async function load() {
      try {
        const data = await getGroupDetail(groupId);
        setGroup(data.group);
        setMembers(data.members);
        setName(data.group.name);
        setAmount(String(data.group.contributionAmount));
        setTotalSlots(String(data.group.totalSlots));
        setFrequency(data.group.frequency);
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
    load();
  }, [groupId]);

  async function handleSave() {
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

    const acceptedCount = members.filter((m) => m.inviteStatus === "accepted").length;
    if (slotsNum < acceptedCount) {
      setError(`Cannot reduce slots below current member count (${acceptedCount})`);
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const result = await updateGroup(groupId, {
        name,
        contributionAmount: amountNum,
        frequency,
        totalSlots: slotsNum,
      });
      setGroup(result.group);
      setMembers(result.members);
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update group. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingScreen />;

  return (
    <Screen>
      <Text style={styles.title}>Edit Group</Text>
      <Text style={styles.subtitle}>
        Update group details. All members will be notified of changes.
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

      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Current members: {members.filter((m) => m.inviteStatus === "accepted").length} / {group?.totalSlots}
        </Text>
      </View>

      <Button
        title="Save Changes"
        onPress={handleSave}
        loading={saving}
        style={styles.saveButton}
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
  infoBox: {
    backgroundColor: colors.primarySoft,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
    fontWeight: typography.weights.medium,
  },
  saveButton: {
    marginTop: spacing.lg,
  },
});