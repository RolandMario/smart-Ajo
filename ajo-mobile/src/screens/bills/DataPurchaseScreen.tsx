import React, { useState, useEffect, useMemo } from "react";
import { StyleSheet, Text, View, Pressable, FlatList } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BillsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { colors, radii, spacing, typography } from "../../theme";
import { listDataPlans } from "../../api/bills";
import { ApiError } from "../../api/api-error";

type Props = NativeStackScreenProps<BillsStackParamList, "DataPurchase">;

type PlanCategory = "all" | "daily" | "2-days" | "weekly" | "monthly" | "yearly";

const NETWORKS = ["mtn", "airtel", "glo", "9mobile"];

const FILTER_TABS: { label: string; value: PlanCategory }[] = [
  { label: "All", value: "all" },
  { label: "Daily", value: "daily" },
  { label: "2 Days", value: "2-days" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

function classifyPlan(name: string): PlanCategory | null {
  const n = name.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/-/g, " ");
  if (/\byear\b|\bannual\b/.test(n)) return "yearly";
  if (/\bmonth\b/.test(n)) return "monthly";
  if (/\bweek\b|\bweekly\b/.test(n)) return "weekly";
  if (/\b2\s*days?\b|\btwo\s*days?\b/.test(n)) return "2-days";
  if (/\bdaily\b|\b1\s*days?\b|\bday\b/.test(n)) return "daily";
  return null;
}

export function DataPurchaseScreen({ navigation }: Props) {
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState("");
  const [plans, setPlans] = useState<any[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<PlanCategory>("all");

  async function loadPlans(net: string) {
    setLoadingPlans(true);
    setPlans([]);
    setSelectedPlan(null);
    setError(null);
    setActiveFilter("all");
    try {
      const data = await listDataPlans(net);
      setPlans(data);
    } catch (err) {
      let message = "Failed to load data plans. Tap retry.";
      if (err instanceof ApiError) {
        if (err.isNetworkError) {
          message = "Cannot reach server. Check your internet and retry.";
        } else if (err.isUnauthorized) {
          message = "Session expired. Please log in again.";
        } else {
          const raw = err.body?.message ?? err.message ?? message;
          message = Array.isArray(raw) ? raw.join(", ") : raw;
        }
      }
      setError(message);
    } finally {
      setLoadingPlans(false);
    }
  }

  useEffect(() => {
    if (network) {
      void loadPlans(network);
    }
  }, [network]);

  const availableCategories = useMemo(() => {
    const categories = new Set<PlanCategory>();
    for (const p of plans) {
      const cat = classifyPlan(p.name);
      if (cat) categories.add(cat);
    }
    return categories;
  }, [plans]);

  const visibleTabs = useMemo(() => {
    return FILTER_TABS.filter((tab) => {
      if (tab.value === "all") return true;
      return availableCategories.has(tab.value);
    });
  }, [availableCategories]);

  const filteredPlans = useMemo(() => {
    if (activeFilter === "all") return plans;
    return plans.filter((p) => classifyPlan(p.name) === activeFilter);
  }, [plans, activeFilter]);

  function handleContinue() {
    if (!phone.trim() || phone.length < 10) { setError("Enter a valid phone number"); return; }
    if (!selectedPlan) { setError("Select a data plan"); return; }
    navigation.navigate("BillConfirmation", {
      serviceType: "data",
      provider: network,
      recipient: phone,
      amount: selectedPlan.amount,
      metadata: { variationCode: selectedPlan.variationCode },
    });
  }

  return (
    <Screen>
      <Text style={styles.title}>Buy Data</Text>
      {error && <ErrorBanner message={error} />}
      <TextField label="Phone Number" placeholder="08012345678" keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={11} />
      <Text style={styles.label}>Network</Text>
      <View style={styles.row}>
        {NETWORKS.map((n) => (
          <Pressable key={n} style={({ pressed }) => [styles.chip, network === n && styles.chipActive, pressed && { opacity: 0.8 }]} onPress={() => setNetwork(n)}>
            <Text style={[styles.chipText, network === n && styles.chipTextActive]}>{n.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      {loadingPlans && <LoadingScreen />}
      {!loadingPlans && plans.length === 0 && !error && network && (
        <Text style={styles.emptyText}>No plans available for {network.toUpperCase()} right now.</Text>
      )}
      {plans.length > 0 && !loadingPlans && (
        <>
          <Text style={styles.filterLabel}>Filter by Period</Text>
          <View style={styles.filterRow}>
            {visibleTabs.map((tab) => (
              <Pressable
                key={tab.value}
                style={({ pressed }) => [
                  styles.filterChip,
                  activeFilter === tab.value && styles.filterChipActive,
                  pressed && { opacity: 0.8 },
                ]}
                onPress={() => { setActiveFilter(tab.value); setSelectedPlan(null); }}
              >
                <Text style={[styles.filterChipText, activeFilter === tab.value && styles.filterChipTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <FlatList
            data={filteredPlans}
            keyExtractor={(item) => `${item.variationCode}-${item.name}-${item.amount}`}
            scrollEnabled={false}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No plans match this filter.</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.planItem, selectedPlan?.variationCode === item.variationCode && styles.planItemActive, pressed && { opacity: 0.8 }]}
                onPress={() => setSelectedPlan(item)}
              >
                <Text style={[styles.planName, selectedPlan?.variationCode === item.variationCode && styles.planTextActive]}>{item.name}</Text>
                <Text style={[styles.planAmount, selectedPlan?.variationCode === item.variationCode && styles.planTextActive]}>₦{item.amount}</Text>
              </Pressable>
            )}
          />
        </>
      )}
      {error && !loadingPlans && (
        <Button title="Retry" onPress={() => network && loadPlans(network)} />
      )}
      <Button title="Continue" onPress={handleContinue} disabled={!phone || !selectedPlan} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold, color: colors.ink, marginBottom: spacing.lg },
  label: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.inkSoft, marginBottom: spacing.xs },
  filterLabel: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.inkSoft, marginBottom: spacing.xs },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.ink },
  chipTextActive: { color: colors.white },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radii.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.ink },
  filterChipTextActive: { color: colors.white },
  planItem: { flexDirection: "row", justifyContent: "space-between", padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, marginBottom: spacing.sm },
  planItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  planName: { fontSize: typography.sizes.sm, color: colors.ink, fontWeight: typography.weights.medium },
  planAmount: { fontSize: typography.sizes.sm, color: colors.primary, fontWeight: typography.weights.semibold },
  planTextActive: { color: colors.white },
  emptyText: { fontSize: typography.sizes.sm, color: colors.inkFaint, textAlign: "center", marginVertical: spacing.lg },
});
