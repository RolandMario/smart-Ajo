import React, { useCallback, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type {
  MainTabParamList,
  WalletStackParamList,
} from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { ApiError } from "../../api/api-error";
import { getWalletSummary } from "../../api/wallet";
import type { WalletSummary } from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatNaira } from "../../utils/format";

type Props = CompositeScreenProps<
  NativeStackScreenProps<WalletStackParamList, "WalletHome">,
  BottomTabScreenProps<MainTabParamList, "Wallet">
>;

export function WalletHomeScreen({ navigation }: Props) {
  const [summary, setSummary] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    try {
      const data = await getWalletSummary();
      setSummary(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load wallet");
      }
    } finally {
      setLoading(false);
    }
  }

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, []),
  );

  if (loading) return <LoadingScreen />;

  const walletActions: WalletCard[] = [
    {
      title: "Fund Wallet",
      subtitle: "Top up your balance",
      onPress: () => navigation.navigate("FundWallet"),
      primary: true,
    },
    {
      title: "Transactions",
      subtitle: "View wallet history",
      onPress: () => navigation.navigate("Transactions"),
    },
    {
      title: "Bank Account",
      subtitle: "Manage withdrawals",
      onPress: () => navigation.navigate("BankAccount"),
    },
    {
      title: "Pay Bills",
      subtitle: "Airtime, data, cable",
      onPress: () => navigation.navigate("Bills", { screen: "BillServices" }),
    },
  ];

  const savingsActions: WalletCard[] = [
    {
      title: "Create Savings",
      subtitle: "Individual auto-savings",
      onPress: () => navigation.navigate("CreateSavingsPlan"),
      primary: true,
    },
    {
      title: "Ajo",
      subtitle: "Join & run thrift groups",
      onPress: () => navigation.navigate("GroupsTab", { screen: "GroupsList" }),
    },
  ];

  return (
    <Screen scrollable={false}>
      <Text style={styles.title}>Wallet</Text>

      {error && <ErrorBanner message={error} />}

      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Your Balance</Text>
        <Text style={styles.balanceAmount}>
          {summary ? formatNaira(summary.balance) : "₦0"}
        </Text>
        {summary && <Text style={styles.currency}>{summary.currency}</Text>}
      </View>

      <View style={styles.grid}>
        {walletActions.map((card) => (
          <WalletCardView key={card.title} card={card} />
        ))}
      </View>

      <View style={styles.grid}>
        {savingsActions.map((card) => (
          <WalletCardView key={card.title} card={card} />
        ))}
      </View>

      <Pressable
        style={styles.savingsLink}
        onPress={() => navigation.navigate("SavingsPlans")}
        accessibilityRole="button"
      >
        <Text style={styles.savingsLinkText}>View my savings plans</Text>
      </Pressable>
    </Screen>
  );
}

interface WalletCard {
  title: string;
  subtitle: string;
  onPress: () => void;
  /** Clay (primary) background card — otherwise the soft-clay secondary card. */
  primary?: boolean;
}

function WalletCardView({ card }: { card: WalletCard }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        card.primary ? styles.cardPrimary : styles.cardSecondary,
        pressed && styles.cardPressed,
      ]}
      onPress={card.onPress}
      accessibilityRole="button"
      accessibilityLabel={card.title}
    >
      <Text
        style={[
          styles.cardTitle,
          card.primary ? styles.cardTitleOnPrimary : styles.cardTitleOnSecondary,
        ]}
      >
        {card.title}
      </Text>
      <Text
        style={[
          styles.cardSubtitle,
          card.primary
            ? styles.cardSubtitleOnPrimary
            : styles.cardSubtitleOnSecondary,
        ]}
      >
        {card.subtitle}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.lg,
  },
  balanceCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  balanceLabel: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    opacity: 0.9,
    marginBottom: spacing.xs,
  },
  balanceAmount: {
    fontSize: 40,
    fontWeight: typography.weights.bold,
    color: colors.white,
  },
  currency: {
    fontSize: typography.sizes.sm,
    color: colors.white,
    opacity: 0.7,
    marginTop: spacing.xs,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  card: {
    width: "47%",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    alignItems: "center",
  },
  cardPressed: {
    opacity: 0.8,
  },
  cardPrimary: {
    backgroundColor: colors.primary,
  },
  cardSecondary: {
    backgroundColor: colors.primarySoft,
  },
  cardTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  cardTitleOnPrimary: {
    color: colors.white,
  },
  cardTitleOnSecondary: {
    color: colors.primary,
  },
  cardSubtitle: {
    fontSize: typography.sizes.xs,
    textAlign: "center",
  },
  cardSubtitleOnPrimary: {
    color: colors.white,
    opacity: 0.85,
  },
  cardSubtitleOnSecondary: {
    color: colors.inkSoft,
  },
  savingsLink: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  savingsLinkText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary,
    textDecorationLine: "underline",
  },
});