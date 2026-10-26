import React, { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type {
  AccountStackParamList,
  RootStackParamList,
} from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { SubpageHeader } from "../../components/SubpageHeader";
import { useAuth } from "../../auth/AuthContext";
import { listMyGroups } from "../../api/groups";
import { getWalletSummary } from "../../api/wallet";
import { formatPhoneForDisplay } from "../../utils/phone";
import { formatNaira, statusLabel } from "../../utils/format";
import { initials } from "../../utils/names";
import type { MyGroupListItem } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";

type Props = CompositeScreenProps<
  NativeStackScreenProps<AccountStackParamList, "ProfileMain">,
  NativeStackScreenProps<RootStackParamList>
>;

/**
 * Profile — the light counterpart to the redesigned auth screens: a pale
 * forest canvas with the forest-green brand on it. The design mock's
 * "NIN & BVN verified" badge and "on-time record" stat have no backing
 * anywhere in ajo-server (no KYC module; no per-user contribution
 * aggregate), so this screen shows honest equivalents instead:
 *
 *  - a "Phone verified" pill driven by the real `isPhoneVerified` flag, and
 *  - a two-cell stat card computed from live data (circle count + wallet
 *    balance) in place of a fabricated on-time score.
 *
 * Opened from the avatar chip in the top-right of every tab root (it used to
 * be a tab of its own), so it carries a back chip. Wallet shortcuts hop back
 * to the Wallet tab rather than mounting a second copy of that stack.
 */
export function ProfileScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const [groups, setGroups] = useState<MyGroupListItem[]>([]);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listMyGroups().catch(() => [] as MyGroupListItem[]),
      getWalletSummary().catch(() => null),
    ]).then(([loadedGroups, wallet]) => {
      if (cancelled) return;
      // A membership whose group no longer exists (e.g. the group was
      // terminated) surfaces from the API as `{ group: undefined, ... }`.
      // Skip those so the render loop never hits `group.name` on undefined —
      // GroupsListScreen already guards this way.
      setGroups(loadedGroups.filter((item) => item?.group != null));
      setBalance(wallet?.balance ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen scrollable={false} backgroundColor={colors.forestLightCanvas}>
      <StatusBar style="dark" />

      <ScrollView>
        <SubpageHeader title="Profile" onBack={() => navigation.goBack()} />

        {/* ---- Identity card -------------------------------------- */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitials}>{initials(user?.name)}</Text>
            </View>

            <View style={styles.identity}>
              <Text style={styles.name} numberOfLines={1}>
                {user?.name ?? "Ajo member"}
              </Text>
              <Text style={styles.phone} numberOfLines={1}>
                {user ? formatPhoneForDisplay(user.phone) : "—"}
              </Text>
            </View>
          </View>

          {user?.isPhoneVerified ? (
            <View style={styles.verifiedPill}>
              <Ionicons
                name="checkmark-circle"
                size={15}
                color={colors.forestAction}
              />
              <Text style={styles.verifiedText}>Phone verified</Text>
            </View>
          ) : null}

          <Button
            title="Edit profile"
            variant="outlineLight"
            icon="pencil"
            onPress={() => navigation.navigate("EditProfile")}
          />
        </View>

        {/* ---- Live stat card ------------------------------------- */}
        <View style={styles.statsCard}>
          <View style={styles.statCell}>
            <Text style={styles.statValue}>{groups.length}</Text>
            <Text style={styles.statLabel}>
              {groups.length === 1 ? "Circle" : "Circles"}
            </Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCell}>
            <Text style={styles.statValue} numberOfLines={1}>
              {balance === null ? "—" : formatNaira(balance)}
            </Text>
            <Text style={styles.statLabel}>Wallet</Text>
          </View>
        </View>

        {/* ---- Circle history ------------------------------------- */}
        <Text style={styles.sectionTitle}>Your circles</Text>

        {groups.length === 0 ? (
          <Text style={styles.emptyText}>
            No circles yet — start one from the Groups tab.
          </Text>
        ) : (
          groups.map(({ group }) => (
            <Pressable
              key={group._id}
              accessibilityRole="button"
              style={styles.circleRow}
              onPress={() =>
                navigation.navigate("Main", {
                  screen: "GroupsTab",
                  params: { screen: "GroupsList" },
                })
              }
            >
              <View style={styles.circleAvatar}>
                <Text style={styles.circleInitials}>{initials(group.name)}</Text>
              </View>

              <View style={styles.circleBody}>
                <Text style={styles.circleName} numberOfLines={1}>
                  {group.name}
                </Text>
                <Text style={styles.circleSub} numberOfLines={1}>
                  {circleSubtitle(group)}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.forestLightInkFaint}
              />
            </Pressable>
          ))
        )}
      {/* ---- Account shortcuts (kept for feature parity) ---- */}
        <Text style={styles.sectionTitle}>Account</Text>

        <Pressable
          style={styles.accountRow}
          onPress={() =>
            navigation.navigate("Main", {
              screen: "Wallet",
              params: { screen: "WalletHome" },
            })
          }
        >
          <Text style={styles.accountText}>Wallet</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.forestLightInkFaint} />
        </Pressable>

        <Pressable
          style={styles.accountRow}
          onPress={() =>
            navigation.navigate("Main", {
              screen: "Wallet",
              params: { screen: "BankAccount" },
            })
          }
        >
          <Text style={styles.accountText}>Bank Account</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.forestLightInkFaint} />
        </Pressable>

        <Pressable
          style={styles.accountRow}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Text style={styles.accountText}>Alerts</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.forestLightInkFaint} />
        </Pressable>

        <Button
          title="Sign out"
          variant="ghost"
          onPress={handleSignOut}
          loading={signingOut}
          style={styles.signOut}
        />
      </ScrollView>
    </Screen>
  );
}

/** "Round 3/10 · Active" — status-only when the group has no round yet. */
function circleSubtitle(group: MyGroupListItem["group"]): string {
  const label = statusLabel(group.status);
  if (group.currentRound && group.totalSlots) {
    return `Round ${group.currentRound}/${group.totalSlots} · ${label}`;
  }
  return label;
}

const styles = StyleSheet.create({
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  profileTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.forestAction,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  },
  identity: {
    flex: 1,
    // Defensive: react-native-web leaves the CSS default `min-width: auto` on
    // flex items, which stops them shrinking below their content. Without
    // this, a long name would push the row (and the whole scroll container)
    // wider than the viewport instead of ellipsising.
    minWidth: 0,
  },
  name: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    marginBottom: spacing.xs,
  },
  phone: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.forestLightPill,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  verifiedText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestAction,
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: colors.forestLightCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  statCell: {
    flex: 1,
    alignItems: "center",
    gap: spacing.xs,
    // See `identity` — keeps a long balance from widening the card.
    minWidth: 0,
  },
  statValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    flexShrink: 1,
  },
  statLabel: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  statDivider: {
    width: 1,
    alignSelf: "stretch",
    backgroundColor: colors.forestLightLine,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.md,
  },
  circleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  circleAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.forestLightPill,
    alignItems: "center",
    justifyContent: "center",
  },
  circleInitials: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestAction,
  },
  circleBody: {
    flex: 1,
    // See `identity`.
    minWidth: 0,
  },
  circleName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  circleSub: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: 2,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    textAlign: "center",
    marginVertical: spacing.lg,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  accountText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInk,
  },
  signOut: {
    marginTop: spacing.xl,
    alignSelf: "center",
  },
});