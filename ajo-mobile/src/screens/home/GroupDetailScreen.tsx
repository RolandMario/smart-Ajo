import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  AppState,
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
import { getGroupDetail, terminateGroup } from "../../api/groups";
import type { GroupDetail } from "../../types/api";
import { useAuth } from "../../auth/AuthContext";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira, statusLabel, formatDate } from "../../utils/format";
import { loadClipboardSafe } from "../../utils/expo-clipboard-client";

type Props = NativeStackScreenProps<GroupsStackParamList, "GroupDetail">;

export function GroupDetailScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const hasDataRef = useRef(false);

  // Refresh data when app comes to foreground (e.g., after payout completes)
  React.useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active" && hasDataRef.current) {
        fetchData();
      }
    });

    return () => subscription.remove();
  }, [groupId]);

  // Update ref when data changes
  React.useEffect(() => {
    if (detail) {
      hasDataRef.current = true;
    }
  }, [detail]);

  async function fetchData() {
    try {
      const groupData = await getGroupDetail(groupId);
      setDetail(groupData);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.isForbidden
            ? "You're not a member of this group yet. Ask the admin for the Group ID, then join from the Join Group screen."
            : err.message,
        );
      } else {
        setError("Failed to load group details");
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

  async function handleShareGroupId() {
    const group = detail?.group;
    if (!group?.joinCode) return;

    const code = group.joinCode;
    setSharing(true);
    try {
      const Clipboard = await loadClipboardSafe();
      if (Clipboard) {
        const message = `Join my Ajo group "${group.name}"\nGroup ID: ${code}`;
        await Clipboard.setStringAsync(message);
        Alert.alert(
          "Group ID copied",
          `Share the ID below so others can search & join.\n\n${code}`,
        );
      } else {
        Alert.alert("Group ID", code);
      }
    } catch {
      Alert.alert("Group ID", code);
    } finally {
      setSharing(false);
    }
  }

  if (loading) return <LoadingScreen />;

  if (!detail) {
    // The request failed — 403 for a non-member (e.g. someone who tapped
    // "View group" from the Join screen), 404 for a deleted group, or a
    // network error. Render the banner instead of destructuring `null`: the
    // old `detail!` assertion threw a TypeError inside render, which crashed
    // the whole screen before the error could be shown.
    return (
      <Screen>
        <Text style={styles.groupName}>{"Can't open this group"}</Text>
        <ErrorBanner
          message={error ?? "This group isn't available right now."}
        />
        <Button title="Go back" onPress={() => navigation.goBack()} />
      </Screen>
    );
  }

  const { group, members } = detail;
  const acceptedMembers = members.filter((m) => m.inviteStatus === "accepted");
  const myMembership = members.find((m) => m.user?._id === user?.id);
  const isAdmin = myMembership?.isGroupAdmin ?? false;

  return (
    <Screen>
      <ScrollView>
        {error && <ErrorBanner message={error} />}

        <View style={styles.header}>
          <Text style={styles.groupName}>{group.name}</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  group.status === "active"
                    ? colors.successSoft
                    : group.status === "completed"
                    ? colors.goldSoft
                    : group.status === "order_locked"
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
                    group.status === "active"
                      ? colors.success
                      : group.status === "completed"
                      ? colors.gold
                      : group.status === "order_locked"
                      ? colors.warning
                      : colors.forestAction,
                },
              ]}
            >
              {statusLabel(group.status)}
            </Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="Contribution" value={`${formatNaira(group.contributionAmount)} / ${group.frequency}`} />
          <InfoRow label="Members" value={`${acceptedMembers.length} / ${group.totalSlots}`} />
          <InfoRow label="Rotation" value={group.rotationMethod === "random" ? "Random" : "Manual"} />
          <InfoRow label="Group ID" value={group.joinCode} />
          <InfoRow label="Created" value={formatDate(group.createdAt)} isLast />
        </View>

        {/* Admin actions */}
        {isAdmin && group.status === "open_for_invites" && (
          <View style={styles.actionSection}>
            <Text style={styles.sectionTitle}>Admin Actions</Text>
            <Button
              title="Edit Group"
              onPress={() => navigation.navigate("EditGroup", { groupId })}
              style={styles.actionButton}
            />
            <Button
              title="Share Group ID"
              icon="share-social-outline"
              onPress={handleShareGroupId}
              loading={sharing}
              style={styles.actionButton}
            />
            {acceptedMembers.length === group.totalSlots && (
              <Button
                title="Lock Rotation Order"
                onPress={() => navigation.navigate("LockRotation", { groupId })}
                style={styles.actionButton}
              />
            )}
          </View>
        )}

        {isAdmin && group.status === "order_locked" && (
          <View style={styles.actionSection}>
            <Text style={styles.sectionTitle}>Admin Actions</Text>
            <Button
              title="Activate Group"
              onPress={() => navigation.navigate("ActivateGroup", { groupId })}
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Active group actions */}
        {(group.status === "active" || group.status === "order_locked") && (
          <View style={styles.actionSection}>
            <Text style={styles.sectionTitle}>Cycles</Text>
            <Button
              title="View Current Cycle"
              onPress={() => navigation.navigate("CurrentCycle", { groupId })}
              style={styles.actionButton}
            />
            <Button
              title="All Cycles"
              variant="secondary"
              onPress={() => navigation.navigate("CyclesList", { groupId })}
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Completed group actions — admin can continue or permanently delete */}
        {isAdmin && group.status === "completed" && (
          <View style={styles.actionSection}>
            <Text style={styles.sectionTitle}>Group Completed</Text>
            <Button
              title="Continue Group"
              onPress={() => navigation.navigate("ContinueGroup", { groupId })}
              style={styles.actionButton}
            />
            <Button
              title="Delete Group"
              icon="trash-outline"
              variant="danger"
              onPress={() => {
                Alert.alert(
                  "Delete Group",
                  "This permanently deletes the group along with its cycles, contributions, payouts and member history. Members' wallet balances are not affected. This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await terminateGroup(groupId);
                          navigation.goBack();
                        } catch (err) {
                          if (err instanceof ApiError) {
                            setError(err.message);
                          } else {
                            setError("Failed to delete group");
                          }
                        }
                      },
                    },
                  ],
                );
              }}
              style={styles.actionButton}
            />
          </View>
        )}

        {/* Members section */}
        <View style={styles.actionSection}>
          <Text style={styles.sectionTitle}>
            Members ({acceptedMembers.length})
          </Text>
          {acceptedMembers.map((member) => (
            <View key={member._id} style={styles.memberRow}>
              <View>
                <Text style={styles.memberName}>
                  {member.user?.name ?? member.user?.phone ?? "Unknown User"}
                </Text>
                <Text style={styles.memberRole}>
                  {member.isGroupAdmin ? "Admin" : "Member"}
                  {member.position ? ` · Position ${member.position}` : ""}
                </Text>
              </View>
              <View
                style={[
                  styles.memberStatus,
                  {
                    backgroundColor:
                      member.payoutStatus === "collected"
                        ? colors.successSoft
                        : colors.forestLightPill,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.memberStatusText,
                    {
                      color:
                        member.payoutStatus === "collected"
                          ? colors.success
                          : colors.forestAction,
                    },
                  ]}
                >
                  {statusLabel(member.payoutStatus)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {isAdmin && (
          <Button
            title="View All Members & Invites"
            variant="secondary"
            onPress={() =>
              navigation.navigate("GroupMembers", {
                groupId,
                joinCode: group.joinCode,
              })
            }
            style={styles.viewAllButton}
          />
        )}
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  groupName: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
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
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
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
    borderBottomColor: colors.forestLightLine,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  infoValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInk,
  },
  actionSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.md,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  memberName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInk,
  },
  memberRole: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
  },
  memberStatus: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
  },
  memberStatusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  viewAllButton: {
    marginBottom: spacing.xl,
  },
});