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
import { getGroupDetail, lockRotation } from "../../api/groups";
import type { GroupMember } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<GroupsStackParamList, "LockRotation">;

export function LockRotationScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  async function fetchData() {
    try {
      const detail = await getGroupDetail(groupId);
      const accepted = detail.members.filter((m) => m.inviteStatus === "accepted");
      setMembers(accepted);
      // Default order: by position if set, otherwise by creation order
      const sorted = [...accepted].sort((a, b) => {
        if (a.position && b.position) return a.position - b.position;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      setOrderedIds(sorted.map((m) => m._id));
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

  function moveItem(fromIndex: number, toIndex: number) {
    const newOrder = [...orderedIds];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setOrderedIds(newOrder);
  }

  async function handleLockRandom() {
    setSaving(true);
    setError(null);
    try {
      await lockRotation(groupId, {});
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to lock rotation order");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleLockManual() {
    setSaving(true);
    setError(null);
    try {
      await lockRotation(groupId, { order: orderedIds });
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to lock rotation order");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingScreen />;

  const isRandom = members.length > 0 && members[0] && true; // Check group rotation method from context
  // We'll default to manual ordering since we can't easily get the group's rotationMethod here

  return (
    <Screen scrollable={false}>
      <Text style={styles.title}>Set Payout Order</Text>
      <Text style={styles.subtitle}>
        Arrange members in the order they will receive payouts. Position 1 collects first.
      </Text>

      {error && <ErrorBanner message={error} />}

      <FlatList
        data={orderedIds}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const member = members.find((m) => m._id === item);
          if (!member) return null;
          return (
            <View style={styles.memberRow}>
              <View style={styles.positionBadge}>
                <Text style={styles.positionText}>{index + 1}</Text>
              </View>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {member.user.name ?? member.user.phone}
                </Text>
                <Text style={styles.memberRole}>
                  {member.isGroupAdmin ? "Admin" : "Member"}
                </Text>
              </View>
              <View style={styles.moveButtons}>
                <Pressable
                  style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                  onPress={() => index > 0 && moveItem(index, index - 1)}
                  disabled={index === 0}
                >
                  <Text style={[styles.moveButtonText, index === 0 && styles.moveButtonTextDisabled]}>
                    ▲
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.moveButton,
                    index === orderedIds.length - 1 && styles.moveButtonDisabled,
                  ]}
                  onPress={() =>
                    index < orderedIds.length - 1 && moveItem(index, index + 1)
                  }
                  disabled={index === orderedIds.length - 1}
                >
                  <Text
                    style={[
                      styles.moveButtonText,
                      index === orderedIds.length - 1 && styles.moveButtonTextDisabled,
                    ]}
                  >
                    ▼
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />

      <View style={styles.actions}>
        <Button
          title="Lock Random Order"
          variant="secondary"
          onPress={handleLockRandom}
          loading={saving}
          style={styles.actionButton}
        />
        <Button
          title="Lock This Order"
          onPress={handleLockManual}
          loading={saving}
          style={styles.actionButton}
        />
      </View>
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
  list: {
    flexGrow: 1,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  positionBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  positionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  memberRole: {
    fontSize: typography.sizes.xs,
    color: colors.inkSoft,
  },
  moveButtons: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  moveButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  moveButtonDisabled: {
    opacity: 0.3,
  },
  moveButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary,
  },
  moveButtonTextDisabled: {
    color: colors.inkFaint,
  },
  actions: {
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {},
});