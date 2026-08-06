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
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { listMyGroups , listMyInvites } from "../../api/groups";
import type { MyGroupListItem, MyInviteListItem } from "../../types/api";
import { useAuth } from "../../auth/AuthContext";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira, statusLabel, formatDate } from "../../utils/format";

type Props = NativeStackScreenProps<GroupsStackParamList, "GroupsList">;

export function GroupsListScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [groups, setGroups] = useState<MyGroupListItem[]>([]);
  const [invites, setInvites] = useState<MyInviteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchData() {
    try {
      const [groupData, inviteData] = await Promise.all([
        listMyGroups(),
        listMyInvites(),
      ]);
      setGroups(groupData);
      setInvites(inviteData);
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

  const pendingInvites = invites.length;

  return (
    <Screen scrollable={false}>
      <View style={styles.header}>
        <Text style={styles.title}>My Groups</Text>
        <Text style={styles.subtitle}>
          Welcome, {user?.name ?? user?.phone}
        </Text>
      </View>

      {error && <ErrorBanner message={error} />}

      {pendingInvites > 0 && (
        <Pressable
          style={styles.inviteBanner}
          onPress={() => navigation.navigate("GroupDetail", { groupId: "invites" })}
        >
          <Text style={styles.inviteBannerText}>
            {pendingInvites} pending invite{pendingInvites !== 1 ? "s" : ""} — tap to view
          </Text>
        </Pressable>
      )}

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
                navigation.navigate("GroupDetail", { groupId: item.group._id })
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
                          ? colors.accentSoft
                          : item.group.status === "order_locked"
                          ? colors.warningSoft
                          : colors.primarySoft,
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
                            ? colors.accent
                            : item.group.status === "order_locked"
                            ? colors.warning
                            : colors.primary,
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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
    marginTop: spacing.xs,
  },
  inviteBanner: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  inviteBannerText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.accent,
  },
  list: {
    flexGrow: 1,
    paddingBottom: 80,
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
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
    textAlign: "center",
  },
  groupCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
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
    color: colors.ink,
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
    color: colors.inkSoft,
  },
  metaText: {
    fontSize: typography.sizes.xs,
    color: colors.inkFaint,
  },
  fabContainer: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
});