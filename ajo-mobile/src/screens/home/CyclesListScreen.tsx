import React, { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { listCycles } from "../../api/cycles";
import type { CycleWithPaidCount } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira, formatDate, statusLabel } from "../../utils/format";

type Props = NativeStackScreenProps<GroupsStackParamList, "CyclesList">;

export function CyclesListScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const [cycles, setCycles] = useState<CycleWithPaidCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    try {
      const data = await listCycles(groupId);
      setCycles(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load cycles");
      }
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [groupId]),
  );

  if (loading) return <LoadingScreen />;

  return (
    <Screen scrollable={false}>
      <Text style={styles.title}>All Cycles</Text>

      {error && <ErrorBanner message={error} />}

      <FlatList
        data={cycles}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No cycles yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isCurrent = false; // Would need group context
          return (
            <Pressable
              style={styles.cycleCard}
              onPress={() =>
                navigation.navigate("CycleDetail", {
                  groupId,
                  cycleId: item._id,
                })
              }
            >
              <View style={styles.cycleHeader}>
                <Text style={styles.cycleNumber}>
                  Cycle {item.cycleNumber}
                </Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.status === "completed"
                          ? colors.successSoft
                          : colors.warningSoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          item.status === "completed"
                            ? colors.success
                            : colors.warning,
                      },
                    ]}
                  >
                    {statusLabel(item.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.cycleDetails}>
                <Text style={styles.detailText}>
                  {formatNaira(item.contributionAmount)} each · {item.totalSlots} members
                </Text>
                <Text style={styles.detailText}>
                  Paid: {item.paidCount}/{item.totalSlots}
                </Text>
              </View>
              <Text style={styles.metaText}>
                Due: {formatDate(item.dueDate)}
                {item.completedAt ? ` · Completed: ${formatDate(item.completedAt)}` : ""}
              </Text>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  list: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxxl,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
  },
  cycleCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cycleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  cycleNumber: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  cycleDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
  },
  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.inkFaint,
  },
});