import React, { useCallback, useRef, useState } from "react";
import {
  Alert,
  AppState,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { getGroupDetail, listMyInvites, respondToInvite, terminateGroup } from "../../api/groups";
import type { GroupDetail, MyInviteListItem } from "../../types/api";
import { useAuth } from "../../auth/AuthContext";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira, statusLabel, formatDate } from "../../utils/format";

type Props = NativeStackScreenProps<GroupsStackParamList, "GroupDetail">;

export function GroupDetailScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [invites, setInvites] = useState<MyInviteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responding, setResponding] = useState<string | null>(null);
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
      // When navigating via the invite banner, groupId is "invites" — a
      // magic string, not a real group ID.  Skip getGroupDetail in that
      // case so we don't send "invites" to the server (which rejects it
      // as an invalid ObjectId).
      const [groupData, inviteData] = await Promise.all([
        groupId === "invites" ? Promise.resolve(null) : getGroupDetail(groupId),
        listMyInvites(),
      ]);
      setDetail(groupData);
      setInvites(inviteData);
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

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [groupId]),
  );

  async function handleRespond(inviteId: string, action: "accept" | "decline") {
    setResponding(inviteId);
    try {
      await respondToInvite(inviteId, action);
      await fetchData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    } finally {
      setResponding(null);
    }
  }

  if (loading) return <LoadingScreen />;
  if (!detail && !error && groupId !== "invites") return <LoadingScreen />;

  // If this is the invites view (groupId === "invites"), show pending invites
  if (groupId === "invites") {
    return (
      <Screen>
        <Text style={styles.title}>Pending Invites</Text>
        {error && <ErrorBanner message={error} />}
        {invites.length === 0 ? (
          <View style={styles.emptySection}>
            <Text style={styles.emptyText}>No pending invites</Text>
          </View>
        ) : (
          <ScrollView>
            {invites.map((invite) => (
              <View key={invite.inviteId} style={styles.inviteCard}>
                <Text style={styles.inviteGroupName}>
                  {invite.group.name}
                </Text>
                <Text style={styles.inviteDetail}>
                  Invited by {invite.group.createdBy.name ?? invite.group.createdBy.phone}
                </Text>
                <Text style={styles.inviteDetail}>
                  {formatNaira(invite.group.contributionAmount)} / {invite.group.frequency} · {invite.group.totalSlots} slots
                </Text>
                <View style={styles.inviteActions}>
                  <Button
                    title="Accept"
                    onPress={() => handleRespond(invite.inviteId, "accept")}
                    loading={responding === invite.inviteId}
                    style={styles.inviteActionButton}
                  />
                  <Button
                    title="Decline"
                    variant="secondary"
                    onPress={() => handleRespond(invite.inviteId, "decline")}
                    loading={responding === invite.inviteId}
                    style={styles.inviteActionButton}
                  />
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </Screen>
    );
  }

  const { group, members } = detail!;
  const acceptedMembers = members.filter((m) => m.inviteStatus === "accepted");
  const pendingMembers = members.filter((m) => m.inviteStatus === "pending");
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
                    ? colors.accentSoft
                    : group.status === "order_locked"
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
                    group.status === "active"
                      ? colors.success
                      : group.status === "completed"
                      ? colors.accent
                      : group.status === "order_locked"
                      ? colors.warning
                      : colors.primary,
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
              title="Invite Members"
              onPress={() => navigation.navigate("InviteMember", { groupId })}
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

        {/* Completed group actions — admin can continue or terminate */}
        {isAdmin && group.status === "completed" && (
          <View style={styles.actionSection}>
            <Text style={styles.sectionTitle}>Group Completed</Text>
            <Button
              title="Continue Group"
              onPress={() => navigation.navigate("ContinueGroup", { groupId })}
              style={styles.actionButton}
            />
            <Button
              title="Terminate Group"
              variant="secondary"
              onPress={() => {
                Alert.alert(
                  "Terminate Group",
                  "Are you sure you want to permanently end this group? This action cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Terminate",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await terminateGroup(groupId);
                          navigation.goBack();
                        } catch (err) {
                          if (err instanceof ApiError) {
                            setError(err.message);
                          } else {
                            setError("Failed to terminate group");
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
                        : colors.primarySoft,
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
                          : colors.primary,
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
            onPress={() => navigation.navigate("GroupMembers", { groupId })}
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
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  groupName: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
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
  actionSection: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  actionButton: {
    marginBottom: spacing.sm,
  },
  memberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  memberName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  memberRole: {
    fontSize: typography.sizes.xs,
    color: colors.inkSoft,
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
  emptySection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxxl,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
  },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  inviteGroupName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  inviteDetail: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
    marginBottom: spacing.xs,
  },
  inviteActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  inviteActionButton: {
    flex: 1,
  },
});