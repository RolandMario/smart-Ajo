import React, { useCallback, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
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
import { listCycles } from "../../api/cycles";
import type { CycleWithPaidCount, PopulatedContribution, CurrentCycleResponse } from "../../types/api";
import { useAuth } from "../../auth/AuthContext";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira, formatDate, statusLabel } from "../../utils/format";

type Props = NativeStackScreenProps<GroupsStackParamList, "CycleDetail">;

export function CycleDetailScreen({ navigation, route }: Props) {
  const { groupId, cycleId } = route.params;
  const { user } = useAuth();
  const [cycleData, setCycleData] = useState<CycleWithPaidCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    try {
      const cycles = await listCycles(groupId);
      const found = cycles.find((c) => c._id === cycleId);
      if (found) {
        setCycleData(found);
      } else {
        setError("Cycle not found");
      }
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load cycle details");
      }
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [groupId, cycleId]),
  );

  if (loading) return <LoadingScreen />;

  if (!cycleData) {
    return (
      <Screen>
        <Text style={styles.title}>Cycle Detail</Text>
        {error && <ErrorBanner message={error} />}
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView>
        <Text style={styles.title}>Cycle #{cycleData.cycleNumber}</Text>

        {error && <ErrorBanner message={error} />}

        <View style={styles.infoCard}>
          <InfoRow label="Status" value={statusLabel(cycleData.status)} />
          <InfoRow
            label="Recipient"
            value={cycleData.recipientMember.user.name ?? cycleData.recipientMember.user.phone}
          />
          <InfoRow
            label="Amount"
            value={formatNaira(cycleData.contributionAmount)}
          />
          <InfoRow
            label="Members"
            value={String(cycleData.totalSlots)}
          />
          <InfoRow
            label="Due Date"
            value={formatDate(cycleData.dueDate)}
          />
          <InfoRow
            label="Paid"
            value={`${cycleData.paidCount ?? 0}/${cycleData.totalSlots}`}
            isLast
          />
        </View>

        {cycleData.completedAt && (
          <Text style={styles.completedText}>
            Completed: {formatDate(cycleData.completedAt)}
          </Text>
        )}

        <Button
          title="View Current Cycle"
          onPress={() => navigation.navigate("CurrentCycle", { groupId })}
          style={styles.viewCurrentButton}
        />
      </ScrollView>
    </Screen>
  );
}

function InfoRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
  },
  infoValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  completedText: {
    fontSize: typography.sizes.sm,
    color: colors.success,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.lg,
  },
  viewCurrentButton: {
    marginTop: spacing.md,
  },
});