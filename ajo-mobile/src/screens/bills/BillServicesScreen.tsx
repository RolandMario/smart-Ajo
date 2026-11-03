import React, { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type {
  BillsStackParamList,
  MainTabParamList,
} from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { AccountMenu } from "../../components/AccountMenu";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import {
  BILL_SERVICE_META,
  BillTransactionRow,
} from "../../components/BillTransactionRow";
import { getBillHistory, getBillServices } from "../../api/bills";
import type { BillServiceType, BillTransaction } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";

type Props = CompositeScreenProps<
  NativeStackScreenProps<BillsStackParamList, "BillServices">,
  BottomTabScreenProps<MainTabParamList, "Bills">
>;

/** Services rendered in the order the design presents them. */
const SERVICE_ORDER: BillServiceType[] = [
  "airtime",
  "data",
  "cable",
  "electricity",
];

const SERVICE_ROUTES: Record<
  BillServiceType,
  | "AirtimePurchase"
  | "DataPurchase"
  | "CableSubscription"
  | "ElectricityPayment"
> = {
  airtime: "AirtimePurchase",
  data: "DataPurchase",
  cable: "CableSubscription",
  electricity: "ElectricityPayment",
};

/** Rows shown on the home screen before "View all" takes over. */
const RECENT_TO_SHOW = 3;

interface QuickAction {
  key: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  background: string;
  foreground: string;
  onPress: () => void;
}

/**
 * Bills tab home — a standard header (title, subtitle, account avatar), a
 * 3-column Quick Actions grid of the admin-enabled bill services, and a
 * Recent Transactions list backed by GET /bills/history, with "View all"
 * opening the full Bill History screen.
 *
 * The wallet-balance card is intentionally omitted: the balance lives on the
 * Wallet home, and "Add Money" here is the shortcut to top up. Only services
 * the admin has enabled are shown (GET /bills/services), so a tile never
 * leads to a provider that isn't configured.
 */
export function BillServicesScreen({ navigation }: Props) {
  const [services, setServices] = useState<BillServiceType[] | null>(null);
  const [history, setHistory] = useState<BillTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [serviceList, billHistory] = await Promise.all([
      getBillServices().catch(() => [] as BillServiceType[]),
      getBillHistory().catch(() => null),
    ]);

    setServices(serviceList);
    if (billHistory) {
      setHistory(billHistory);
      setError(null);
    } else {
      setHistory([]);
      setError("Couldn't load recent bill payments.");
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData]),
  );

  if (loading) return <LoadingScreen />;

  const enabledServices = SERVICE_ORDER.filter((type) =>
    (services ?? []).includes(type),
  );

  const quickActions: QuickAction[] = [
    ...enabledServices.map((type) => {
      const meta = BILL_SERVICE_META[type];
      return {
        key: type,
        title: meta.label,
        icon: meta.icon,
        background: meta.background,
        foreground: meta.foreground,
        onPress: () => navigation.navigate(SERVICE_ROUTES[type]),
      };
    }),
    {
      key: "history",
      title: "History",
      icon: "time-outline",
      background: colors.forestLightPill,
      foreground: colors.forestAction,
      onPress: () => navigation.navigate("BillHistory"),
    },
    {
      key: "add-money",
      title: "Add Money",
      icon: "wallet-outline",
      background: colors.goldSoft,
      foreground: colors.gold,
      onPress: () => navigation.navigate("Wallet", { screen: "FundWallet" }),
    },
  ];

  const recent = history.slice(0, RECENT_TO_SHOW);

  return (
    <Screen>
      <StatusBar style="dark" />

      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Pay Bills</Text>
          <Text style={styles.subtitle}>
            Top-up, data, TV and electricity — paid from your SmartThrift wallet.
          </Text>
        </View>
        <AccountMenu />
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.grid}>
        {quickActions.map((action) => (
          <Pressable
            key={action.key}
            accessibilityRole="button"
            accessibilityLabel={action.title}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
            onPress={action.onPress}
          >
            <View
              style={[styles.tileIcon, { backgroundColor: action.background }]}
            >
              <Ionicons name={action.icon} size={22} color={action.foreground} />
            </View>
            <Text style={styles.tileLabel} numberOfLines={2}>
              {action.title}
            </Text>
          </Pressable>
        ))}
      </View>

      {enabledServices.length === 0 ? (
        <Text style={styles.emptyNote}>
          Bill services are not available right now.
        </Text>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View all bill payments"
          style={styles.viewAll}
          onPress={() => navigation.navigate("BillHistory")}
        >
          <Text style={styles.viewAllText}>View all</Text>
          <Ionicons
            name="chevron-forward"
            size={14}
            color={colors.forestLightInkSoft}
          />
        </Pressable>
      </View>

      {recent.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons
              name="receipt-outline"
              size={22}
              color={colors.forestAction}
            />
          </View>
          <Text style={styles.emptyTitle}>No bill payments yet</Text>
          <Text style={styles.emptySubtitle}>
            Buy airtime, data, cable or electricity and it will show up here.
          </Text>
        </View>
      ) : (
        recent.map((transaction) => (
          <BillTransactionRow
            key={transaction._id}
            transaction={transaction}
            onPress={() =>
              navigation.navigate("BillSuccess", {
                serviceType: transaction.type,
                reference: transaction.reference,
                amount: transaction.amount,
                recipient: transaction.recipient,
                provider: transaction.provider,
                metadata: transaction.metadata,
                createdAt: transaction.createdAt,
              })
            }
          />
        ))
      )}
    </Screen>
  );
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
  title: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    fontFamily: typography.fontFamilies.serif,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  tile: {
    width: "31.5%",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  tileIcon: {
    width: 46,
    height: 46,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  tileLabel: {
    fontSize: typography.sizes.sm,
    lineHeight: 18,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    textAlign: "center",
  },
  emptyNote: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: -spacing.md,
    marginBottom: spacing.xl,
  },
  viewAll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: spacing.xs,
    paddingLeft: spacing.sm,
  },
  viewAllText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInkSoft,
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.full,
    backgroundColor: colors.forestLightPill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});

