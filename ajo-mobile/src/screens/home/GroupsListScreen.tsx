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
import { AccountMenu } from "../../components/AccountMenu";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { listMyGroups } from "../../api/groups";
import type { MyGroupListItem } from "../../types/api";
import { useAuth } from "../../auth/AuthContext";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira, statusLabel, formatDate } from "../../utils/format";

type Props = NativeStackScreenProps<GroupsStackParamList, "GroupsList">;

export function GroupsListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<MyGroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try {
      const groupData = await listMyGroups();
      setGroups(groupData);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load groups");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, []),
  );

  function handleRefresh() {
    setRefreshing(true);
    fetchData();
  }

  if (loading && groups.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <Screen scrollable={false}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>My Groups</Text>
          <Text style={styles.subtitle}>
            Welcome, {user?.name ?? user?.phone}
          </Text>
        </View>
        <AccountMenu />
      </View>

      {error && <ErrorBanner message={error} />}

      <FlatList
        data={groups}
        keyExtractor={(item) => item.group?._id ?? Math.random().toString()}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first savings group to get started.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          if (!item.group) return null;
          return (
            <Pressable
              style={styles.groupCard}
              onPress={() =>
                navigation.navigate("CurrentCycle", { groupId: item.group._id })
              }
            >
              <View style={styles.groupHeader}>
                <Text style={styles.groupName}>{item.group.name}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        item.group.status === "active"
                          ? colors.successSoft
                          : item.group.status === "completed"
                          ? colors.goldSoft
                          : item.group.status === "order_locked"
                          ? colors.warningSoft
                          : colors.forestLightPill,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      {
                        color:
                          item.group.status === "active"
                            ? colors.success
                            : item.group.status === "completed"
                            ? colors.gold
                            : item.group.status === "order_locked"
                            ? colors.warning
                            : colors.forestAction,
                      },
                    ]}
                  >
                    {statusLabel(item.group.status)}
                  </Text>
                </View>
              </View>
              <View style={styles.groupDetails}>
                <Text style={styles.detailText}>
                  {formatNaira(item.group.contributionAmount)} / {item.group.frequency}
                </Text>
                <Text style={styles.detailText}>
                  {item.membership?.isGroupAdmin ? "Admin" : "Member"}
                  {item.membership?.position ? ` · Position ${item.membership.position}` : ""}
                </Text>
              </View>
              <Text style={styles.metaText}>
                Created {formatDate(item.group.createdAt)} · {item.group.totalSlots} slots
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.fabContainer}>
        <Button
          title="Create Group"
          onPress={() => navigation.navigate("CreateGroup")}
        />
        <Button
          title="Join with Group ID"
          variant="secondary"
          icon="search"
          onPress={() => navigation.navigate("JoinGroup")}
          style={styles.joinButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
  },
  list: {
    flexGrow: 1,
    paddingBottom: 120,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxxl * 2,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    textAlign: "center",
  },
  groupCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  groupName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    flex: 1,
    marginRight: spacing.sm,
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
  groupDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
  },
  fabContainer: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  joinButton: {
    marginTop: spacing.sm,
  },
});