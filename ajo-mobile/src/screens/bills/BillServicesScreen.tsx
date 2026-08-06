import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BillsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<BillsStackParamList, "BillServices">;

const SERVICES = [
  { key: "airtime", title: "Airtime", subtitle: "Buy airtime for any network", route: "AirtimePurchase" as const },
  { key: "data", title: "Data", subtitle: "Purchase data bundles", route: "DataPurchase" as const },
  { key: "cable", title: "Cable TV", subtitle: "DSTV, GOtv, StarTimes", route: "CableSubscription" as const },
  { key: "electricity", title: "Electricity", subtitle: "Prepaid & postpaid bills", route: "ElectricityPayment" as const },
];

export function BillServicesScreen({ navigation }: Props) {
  return (
    <Screen>
      <Text style={styles.title}>Pay Bills</Text>
      <View style={styles.grid}>
        {SERVICES.map((s) => (
          <Pressable
            key={s.key}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => navigation.navigate(s.route)}
          >
            <Text style={styles.cardTitle}>{s.title}</Text>
            <Text style={styles.cardSubtitle}>{s.subtitle}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.sectionTitle}>Recent</Text>
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No bill payments yet</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold, color: colors.ink, marginBottom: spacing.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginBottom: spacing.xl },
  card: { width: "47%", backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, alignItems: "center" },
  cardPressed: { opacity: 0.8 },
  cardTitle: { fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.ink, marginBottom: spacing.xs },
  cardSubtitle: { fontSize: typography.sizes.xs, color: colors.inkSoft, textAlign: "center" },
  sectionTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.ink, marginBottom: spacing.md },
  empty: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyText: { fontSize: typography.sizes.base, color: colors.inkFaint },
});
