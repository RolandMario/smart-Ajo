import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ApiError } from "../../api/api-error";
import { searchGroupByCode, joinGroupByCode } from "../../api/groups";
import type { GroupSearchResult } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira } from "../../utils/format";

type Props = NativeStackScreenProps<GroupsStackParamList, "JoinGroup">;

export function JoinGroupScreen({ navigation }: Props) {
  const [code, setCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GroupSearchResult | null>(null);

  async function handleSearch() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a Group ID to search.");
      return;
    }

    setError(null);
    setResult(null);
    setSearching(true);
    try {
      setResult(await searchGroupByCode(trimmed));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not find a group with that ID.");
      }
    } finally {
      setSearching(false);
    }
  }

  async function handleJoin() {
    const trimmed = code.trim().toUpperCase();
    setError(null);
    setJoining(true);
    try {
      const joined = await joinGroupByCode(trimmed);
      navigation.replace("GroupDetail", { groupId: joined.group._id });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not join the group. Please try again.");
      }
      setJoining(false);
    }
  }

  const group = result?.group;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <Text style={styles.title}>Join a Group</Text>
        <Text style={styles.subtitle}>
          Enter the Group ID your admin shared with you to find the group and
          request to join.
        </Text>

        {error && <ErrorBanner message={error} />}

        <View style={styles.searchRow}>
          <View style={styles.fieldWrap}>
            <TextField
              label="Group ID"
              placeholder="e.g. 7K3QP2MA"
              value={code}
              onChangeText={(text) => {
                setCode(text);
                setResult(null);
                setError(null);
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
          </View>
          <Button
            title="Search"
            onPress={handleSearch}
            loading={searching}
            disabled={!code.trim()}
            style={styles.searchButton}
          />
        </View>

        {group && (
          <View style={styles.card}>
            <Text style={styles.groupName}>{group.name}</Text>
            <Text style={styles.detail}>
              {formatNaira(group.contributionAmount)} / {group.frequency} ·{" "}
              {result!.memberCount} / {group.totalSlots} members
            </Text>

            {result!.joinable ? (
              <>
                <Text style={styles.openNote}>
                  This group is open for new members. Tap join to become a member.
                </Text>
                <Button
                  title="Join Group"
                  onPress={handleJoin}
                  loading={joining}
                  style={styles.actionButton}
                />
              </>
            ) : (
              <View style={styles.noticeBox}>
                {result!.isAdmin && (
                  <Text style={styles.noticeText}>
                    You are the admin of this group.
                  </Text>
                )}
                {!result!.isAdmin && result!.isMember && (
                  <Text style={styles.noticeText}>
                    You are already a member of this group.
                  </Text>
                )}
                {!result!.isAdmin && !result!.isMember && result!.isFull && (
                  <Text style={styles.noticeText}>
                    This group is full ({group.totalSlots} / {group.totalSlots} members).
                  </Text>
                )}
                {!result!.isAdmin &&
                  !result!.isMember &&
                  !result!.isFull && (
                    <Text style={styles.noticeText}>
                      This group is not open for new members right now.
                    </Text>
                  )}
              </View>
            )}

            {/* GET /groups/:id is member-only (403 otherwise), so only
                offer the link to people the server will actually let in.
                Non-members get everything they need from this card. */}
            {(result!.isMember || result!.isAdmin) && (
              <Pressable
                onPress={() =>
                  navigation.navigate("GroupDetail", { groupId: group._id })
                }
              >
                <Text style={styles.viewGroupLink}>View group</Text>
              </Pressable>
            )}
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}


const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  fieldWrap: {
    flex: 1,
  },
  searchButton: {
    minHeight: 52,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginTop: spacing.sm,
  },
  groupName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.xs,
  },
  detail: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.md,
  },
  openNote: {
    fontSize: typography.sizes.sm,
    color: colors.forestAction,
    marginBottom: spacing.md,
  },
  noticeBox: {
    backgroundColor: colors.forestLightPill,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noticeText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  actionButton: {
    marginBottom: spacing.md,
  },
  viewGroupLink: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestAction,
    textAlign: "center",
  },
});
