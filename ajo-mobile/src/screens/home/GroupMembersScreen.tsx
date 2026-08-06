import React, { useCallback, useRef, useState } from "react";
import {
  AppState,
  FlatList,
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
import { getGroupMembers } from "../../api/groups";
import type { GroupMember } from "../../types/api";
import { useAuth } from "../../auth/AuthContext";
import { colors, radii, spacing, typography } from "../../theme";
import { statusLabel } from "../../utils/format";

type Props = NativeStackScreenProps<GroupsStackParamList, "GroupMembers">;

export function GroupMembersScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { user } = useAuth();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasDataRef = useRef(false);

  async function fetchData() {
    try {
      const data = await getGroupMembers(groupId);
      setMembers(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load members");
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
    if (members.length > 0) {
      hasDataRef.current = true;
    }
  }, [members.length]);

  if (loading) return <LoadingScreen />;

  const acceptedMembers = members.filter((m) => m.inviteStatus === "accepted");
  const pendingMembers = members.filter((m) => m.inviteStatus === "pending");
  const declinedMembers = members.filter((m) => m.inviteStatus === "declined");
  const myMembership = members.find((m) => m.user._id === user?.id);
  const isAdmin = myMembership?.isGroupAdmin ?? false;

  return (
    <Screen scrollable={false}>
      {error && <ErrorBanner message={error} />}

      {isAdmin && (
        <Button
          title="Invite Members"
          onPress={() => navigation.navigate("InviteMember", { groupId })}
          style={styles.inviteButton}
        />
      )}

      <Text style={styles.sectionTitle}>
        Accepted ({acceptedMembers.length})
      </Text>
      <FlatList
        data={acceptedMembers}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>
                {item.user.name ?? item.user.phone}
                {item.isGroupAdmin ? " (Admin)" : ""}
              </Text>
              <Text style={styles.memberDetail}>
                {item.position ? `Position ${item.position}` : "No position"}
                {item.user.email ? ` · ${item.user.email}` : ""}
              </Text>
            </View>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    item.payoutStatus === "collected"
                      ? colors.successSoft
                      : colors.primarySoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      item.payoutStatus === "collected"
                        ? colors.success
                        : colors.primary,
                  },
                ]}
              >
                {statusLabel(item.payoutStatus)}
              </Text>
            </View>
          </View>
        )}
      />

      {pendingMembers.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Pending Invites ({pendingMembers.length})
          </Text>
          {pendingMembers.map((item) => (
            <View key={item._id} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {item.user.name ?? item.user.phone}
                </Text>
                <Text style={styles.memberDetail}>
                  Invited {item.invitedAt ? new Date(item.invitedAt).toLocaleDateString() : ""}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.warningSoft }]}>
                <Text style={[styles.statusText, { color: colors.warning }]}>
                  Pending
                </Text>
              </View>
            </View>
          ))}
        </>
      )}

      {declinedMembers.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Declined ({declinedMembers.length})
          </Text>
          {declinedMembers.map((item) => (
            <View key={item._id} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {item.user.name ?? item.user.phone}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: colors.dangerSoft }]}>
                <Text style={[styles.statusText, { color: colors.danger }]}>
                  Declined
                </Text>
              </View>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  inviteButton: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  list: {
    flexGrow: 1,
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
  memberInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  memberName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  memberDetail: {
    fontSize: typography.sizes.xs,
    color: colors.inkSoft,
    marginTop: spacing.xs,
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
});