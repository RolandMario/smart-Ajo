import React, { useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import type {
  MainTabParamList,
  WalletStackParamList,
} from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { AccountMenu } from "../../components/AccountMenu";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { useAuth } from "../../auth/AuthContext";
import { getWalletSummary } from "../../api/wallet";
import { listMyGroups } from "../../api/groups";
import { getCurrentCycle } from "../../api/cycles";
import { listSavingPlans } from "../../api/savings";
import type {
  CurrentCycleResponse,
  Group,
  SavingPlan,
  WalletSummary,
} from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira, pluralize, statusLabel } from "../../utils/format";

type Props = CompositeScreenProps<
  NativeStackScreenProps<WalletStackParamList, "WalletHome">,
  BottomTabScreenProps<MainTabParamList, "Wallet">
>;

/** Rows shown on the home screen before "See all" takes over. */
const CIRCLES_TO_SHOW = 2;
const PLANS_TO_SHOW = 2;

/** One circle row: the membership (group) plus — when the group is active —
 * its live current cycle, which drives the "You collect · 2d"-style pill on
 * the right of the card. */
interface CircleItem {
  group: Group;
  cycle: CurrentCycleResponse | null;
}

/**
 * Wallet home — redesigned to match the fintech home-screen mock: a light
 * forest canvas, a greeting with the member's avatar, a dark green
 * "Wallet balance" card showing the live wallet balance, and live
 * "Your circles" / "Personal savings" sections. The mock's "Kolo" is the
 * template's placeholder brand (that's the "Ajo" swap). Two deliberate
 * deviations, per the README:
 *
 *  - The template's Send/Request affordances don't exist in ajo-server, so
 *    the card's only control is a "Fund wallet" button that opens Fund
 *    wallet — the real top-up entry the mock doesn't show.
 *  - The mock's tab bar (Home/Circles/Save/Wallet) stays the app's own
 *    4 tabs; this screen is the Wallet tab's home.
 */
export function WalletHomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [circles, setCircles] = useState<CircleItem[]>([]);
  const [plans, setPlans] = useState<SavingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    try {
      const [wallet, groupItems, savingPlans] = await Promise.all([
        getWalletSummary().catch(() => null),
        listMyGroups().catch(() => []),
        listSavingPlans().catch(() => []),
      ]);

      // A membership whose group no longer exists (e.g. it was terminated)
      // surfaces from the API as `{ group: undefined, ... }`. Skip those and
      // show active circles first (GroupsListScreen guards the same way).
      const groups = (groupItems ?? [])
        .filter((item) => item?.group != null)
        .map((item) => item.group)
        .sort(
          (a, b) =>
            (b.status === "active" ? 1 : 0) -
            (a.status === "active" ? 1 : 0),
        );

      // The per-circle pill needs each active group's current cycle (next
      // recipient + days until they collect). Best-effort: a failed lookup
      // falls back to an "Active" pill.
      const active = groups.filter((g) => g.status === "active");
      const cycles = await Promise.all(
        active.map((g) => getCurrentCycle(g._id).catch(() => null)),
      );
      const cycleByGroup = new Map<string, CurrentCycleResponse>();
      active.forEach((g, i) => {
        if (cycles[i]) cycleByGroup.set(g._id, cycles[i]);
      });

      setSummary(wallet);
      setCircles(
        groups.map((group) => ({
          group,
          cycle: cycleByGroup.get(group._id) ?? null,
        })),
      );
      setPlans((savingPlans ?? []).filter((p) => p.status === "active"));
      setError(wallet ? null : "Failed to load wallet");
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void fetchData();
    }, []),
  );

  if (loading && !summary && circles.length === 0 && plans.length === 0) {
    return <LoadingScreen />;
  }
  // The balance card shows the live wallet balance alone — savings-goal
  // balances are intentionally not rolled in (they're reported separately
  // under "Personal savings").
  const walletBalance = summary?.balance ?? 0;
  const activeCircleCount = circles.filter(
    (item) => item.group.status === "active",
  ).length;
  const userId = user?.id ?? "";

  return (
    <Screen backgroundColor={colors.forestLightCanvas}>
      <StatusBar style="dark" />

      {error ? <ErrorBanner message={error} /> : null}

      {/* ---- Greeting + account menu (avatar = Alerts / Profile) --- */}
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.headerName} numberOfLines={1}>
            {displayName(user?.name)}
          </Text>
        </View>
        <AccountMenu />
      </View>

      {/* ---- Wallet balance card -------------------------------------- */}
      <View style={styles.balanceCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>Wallet balance</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fund wallet"
            style={({ pressed }) => [
              styles.fundWallet,
              pressed && styles.pressed,
            ]}
            onPress={() => navigation.navigate("FundWallet")}
          >
            <Ionicons name="wallet" size={16} color={colors.onForest} />
            <Text style={styles.fundWalletText}>Fund wallet</Text>
          </Pressable>
        </View>

        <Text style={styles.cardAmount} numberOfLines={1} adjustsFontSizeToFit>
          {formatNaira(walletBalance)}
        </Text>

        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>{activeCircleCount}</Text>
            <Text style={styles.cardStatLabel}>
              {activeCircleCount === 1 ? "active circle" : "active circles"}
            </Text>
          </View>
          <View style={styles.cardStatDivider} />
          <View style={styles.cardStat}>
            <Text style={styles.cardStatValue}>{plans.length}</Text>
            <Text style={styles.cardStatLabel}>
              {plans.length === 1 ? "savings goal" : "savings goals"}
            </Text>
          </View>
        </View>
      </View>
      {/* ---- Your circles ----------------------------------------- */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Your circles</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.seeAll}
          onPress={() =>
            navigation.navigate("GroupsTab", { screen: "GroupsList" })
          }
        >
          <Text style={styles.seeAllText}>See all</Text>
        </Pressable>
      </View>

      {circles.length === 0 ? (
        <Text style={styles.emptyText}>
          No circles yet — start one from the Groups tab.
        </Text>
      ) : (
        circles.slice(0, CIRCLES_TO_SHOW).map((item, index) => (
          <CircleRow
            key={item.group._id}
            item={item}
            index={index}
            userId={userId}
            onPress={() =>
              navigation.navigate("GroupsTab", {
                screen: "CurrentCycle",
                params: { groupId: item.group._id },
              })
            }
          />
        ))
      )}

      {/* ---- Personal savings ------------------------------------- */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Personal savings</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.seeAll}
          onPress={() => navigation.navigate("SavingsTab", { screen: "SavingsList" })}
        >
          <Text style={styles.seeAllText}>See all</Text>
        </Pressable>
      </View>

      {plans.length === 0 ? (
        <Text style={styles.emptyText}>
          No savings goals yet — create one from the Savings tab.
        </Text>
      ) : (
        plans.slice(0, PLANS_TO_SHOW).map((plan) => (
          <SavingsRow
            key={plan._id}
            plan={plan}
            onPress={() =>
              navigation.navigate("SavingsTab", {
                screen: "SavingsPlanDetail",
                params: { planId: plan._id },
              })
            }
          />
        ))
      )}

      {/* ---- Feature parity: the ledger stays reachable ----------- */}
      <Pressable
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.activityLink,
          pressed && styles.pressed,
        ]}
        onPress={() => navigation.navigate("Transactions")}
      >
        <Text style={styles.activityLinkText}>Wallet activity</Text>
        <Ionicons
          name="chevron-forward"
          size={16}
          color={colors.forestLightInkSoft}
        />
      </Pressable>
    </Screen>
  );
}

// ---- Row cards ---------------------------------------------------------

function CircleRow({
  item,
  index,
  userId,
  onPress,
}: {
  item: CircleItem;
  index: number;
  userId: string;
  onPress: () => void;
}) {
  const avatar = avatarTones[index % avatarTones.length];
  const pill = circlePill(item, userId);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.group.name}
      style={({ pressed }) => [styles.circleCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={[styles.circleAvatar, { backgroundColor: avatar.background }]}>
        <Text style={[styles.circleInitials, { color: avatar.foreground }]}>
          {initials(item.group.name)}
        </Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {item.group.name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {item.group.totalSlots}{" "}
          {pluralize(item.group.totalSlots, "member")} ·{" "}
          {item.group.frequency}
        </Text>
      </View>
      <View style={[styles.pill, { backgroundColor: pill.background }]}>
        <Text style={[styles.pillText, { color: pill.foreground }]}>
          {pill.label}
        </Text>
      </View>
    </Pressable>
  );
}

function SavingsRow({
  plan,
  onPress,
}: {
  plan: SavingPlan;
  onPress: () => void;
}) {
  const target = savingsTarget(plan);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${plan.name}: ${formatNaira(
        plan.savingsBalance,
      )} of ${formatNaira(target)}`}
      style={({ pressed }) => [styles.savingsCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.savingsIcon}>
        <Ionicons name="cash-outline" size={20} color={colors.gold} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {plan.name}
        </Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {formatNaira(plan.savingsBalance)} of {formatNaira(target)}
        </Text>
      </View>
      <Text style={styles.savingsPercent}>
        {savingsProgress(plan, target)}%
      </Text>
    </Pressable>
  );
}

// ---- Small data helpers ---------------------------------------------------

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Ngozi Eze" → "NE"; falls back to "?" for missing/blank names. */
function initials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}

/** "Chidinma Amara Nnamdi" → "Chidinma N." (the mock's "Chidinma A." style). */
function displayName(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Ajo member";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

function firstName(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[0] : "Member";
}

/** Whole days between now and `dateStr` (0 if the date is past/absent). */
function daysUntil(dateStr?: string): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000));
}

interface PillTone {
  background: string;
  foreground: string;
}

/** The right-hand pill: who collects next and in how many days' time. */
function circlePill(
  item: CircleItem,
  userId: string,
): { label: string } & PillTone {
  const cycle = item.cycle;
  if (!cycle) {
    return {
      label: statusLabel(item.group.status),
      background: colors.forestLightPill,
      foreground: colors.forestLightInkSoft,
    };
  }
  const recipient = cycle.cycle.recipientMember?.user;
  const mine = recipient?._id === userId;
  const who = mine ? "You collect" : firstName(recipient?.name);
  return {
    label: `${who} · ${daysUntil(cycle.cycle.dueDate)}d`,
    background: mine ? colors.goldSoft : colors.forestLightPill,
    foreground: mine ? colors.gold : colors.forestAction,
  };
}

/** Alternate avatar tints down the list, echoing the mock's gold/green. */
const avatarTones: PillTone[] = [
  { background: colors.goldSoft, foreground: colors.gold },
  { background: colors.forestLightPill, foreground: colors.forestAction },
];

/** A savings goal's plan total: contribution × number of intervals. */
function savingsTarget(plan: SavingPlan): number {
  const intervals =
    plan.intervalCount ||
    plan.durationValue ||
    plan.durationMonths ||
    1;
  return Math.max(0, plan.amount * intervals);
}

function savingsProgress(plan: SavingPlan, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((plan.savingsBalance / target) * 100));
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  greeting: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
  },
  headerName: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  balanceCard: {
    backgroundColor: colors.forest,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLabel: {
    fontSize: typography.sizes.sm,
    color: colors.onForestMuted,
  },
  fundWallet: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.forestLine,
    backgroundColor: colors.onForestTranslucent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  fundWalletText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.onForest,
  },
  cardAmount: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: 40,
    fontWeight: typography.weights.bold,
    color: colors.onForest,
    marginTop: spacing.xs,
  },
  cardStats: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.forestLine,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  cardStat: {
    flex: 1,
    gap: spacing.xs,
  },
  cardStatDivider: {
    width: 1,
    alignSelf: "stretch",
    marginHorizontal: spacing.md,
    backgroundColor: colors.forestLine,
  },
  cardStatValue: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.onForest,
  },
  cardStatLabel: {
    fontSize: typography.sizes.xs,
    color: colors.onForestMuted,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  seeAll: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  seeAllText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInkSoft,
  },
  circleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  circleAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  circleInitials: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.md,
  },
  rowTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  rowSub: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: 2,
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  pillText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  savingsCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.forestLightCard,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  savingsIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.goldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  savingsPercent: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.forestAction,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    textAlign: "center",
    marginVertical: spacing.md,
  },
  activityLink: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: spacing.xs,
    marginTop: spacing.xl,
  },
  activityLinkText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInkSoft,
  },
  pressed: {
    opacity: 0.7,
  },
});