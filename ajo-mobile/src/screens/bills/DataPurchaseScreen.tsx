import React, { useState, useEffect, useMemo } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
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
import type { DataPlan } from "../../types/api";

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

/**
 * Extract the validity/period of a data plan from its provider name.
 * Handles everyday labels ("MTN 1GB Daily"), numeric validity ("Airtel 2GB
 * 30 Days", "GLO 7 Days"), and plan-coded names ("MTN SME 6GB 31DAYS").
 * Returns the period used by the "Filter by Period" chips plus a
 * human-friendly duration label rendered on the plan card.
 */
function planDuration(name: string): { period: PlanCategory | null; label: string } {
  const n = ` ${name.toLowerCase().replace(/-/g, " ")} `.replace(/\s+/g, " ");

  // Explicit named validity takes precedence, in descending order.
  if (/\b(year|yearly|annual|12\s*months?)\b/.test(n)) {
    return { period: "yearly", label: "Yearly" };
  }
  if (/\b(week|weekly)\b/.test(n)) {
    if (/\b2\s*weeks?\b/.test(n)) return { period: "2-days", label: "2 Weeks" };
    return { period: "weekly", label: "Weekly" };
  }
  if (/\btwo\s*days?\b|\b2\s*days?\b/.test(n)) return { period: "2-days", label: "2 Days" };
  if (/\b(daily|1\s*day)\b/.test(n)) return { period: "daily", label: "Daily" };

  // Numeric "N days" / "N months" validity.
  const months = n.match(/(\d+)\s*months?/);
  if (months) {
    const m = parseInt(months[1], 10);
    return {
      period: m >= 12 ? "yearly" : "monthly",
      label: m === 1 ? "1 Month" : `${m} Months`,
    };
  }
  const days = n.match(/(\d+)\s*days?/);
  if (days) {
    const d = parseInt(days[1], 10);
    if (d === 2) return { period: "2-days", label: "2 Days" };
    if (d === 7) return { period: "weekly", label: "7 Days" };
    if (d >= 28 && d <= 31) return { period: "monthly", label: `${d} Days` };
    if (d >= 360) return { period: "yearly", label: `${d} Days` };
    return { period: "daily", label: `${d} Days` };
  }

  // Common plan-type keyword embedded in provider names.
  if (/\bmonthly\b/.test(n)) return { period: "monthly", label: "Monthly" };

  return { period: null, label: name };
}

/**
 * Extract the data volume (size) from a provider plan name, e.g. "5GB",
 * "500MB", or "1.5GB" from names like "MTN 5GB", "GLO 2GB Daily" or
 * "MTN SME 6GB 31DAYS". Falls back to the raw name when no volume is found.
 */
function planSize(name: string): string {
  const m = name.match(/(\d+(?:\.\d+)?\s*(?:gb|mb|tb))/i);
  if (m) {
    return m[1].toUpperCase().replace(/\s+/g, "");
  }
  return name;
}

/** Number of plan cards laid out across each grid row. */
const GRID_COLUMNS = 3;

/**
 * Split an array into a multi-dimensional grid: an array of rows, where each
 * row holds up to `GRID_COLUMNS` cells. Used to lay the plan cards out in
 * columns.
 */
function chunk<T>(array: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    rows.push(array.slice(i, i + size));
  }
  return rows;
}

export function DataPurchaseScreen({ navigation }: Props) {
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState("");
  const [plans, setPlans] = useState<DataPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<DataPlan | null>(null);
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
      const { period } = planDuration(p.name);
      if (period) categories.add(period);
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
    return plans.filter((p) => planDuration(p.name).period === activeFilter);
  }, [plans, activeFilter]);

  // Multi-dimensional layout: rows of `GRID_COLUMNS` cards each.
  const grid = useMemo(() => chunk(filteredPlans, GRID_COLUMNS), [filteredPlans]);

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
          {grid.length === 0 ? (
            <Text style={styles.emptyText}>No plans match this filter.</Text>
          ) : (
            grid.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.planGridRow}>
                {row.map((item) => {
                  const active = selectedPlan?.variationCode === item.variationCode;
                  const duration = planDuration(item.name);
                  return (
                    <Pressable
                      key={`${item.variationCode}-${item.name}-${item.amount}`}
                      style={({ pressed }) => [
                        styles.planCard,
                        active && styles.planCardActive,
                        pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
                      ]}
                      onPress={() => setSelectedPlan(item)}
                    >
                      <Text
                        style={[styles.planName, active && styles.planTextActive]}
                        numberOfLines={1}
                      >
                        {planSize(item.name)}
                      </Text>
                      <View style={[styles.durationBadge, active && styles.durationBadgeActive]}>
                        <Text style={[styles.durationText, active && styles.durationTextActive]}>
                          {duration.label}
                        </Text>
                      </View>
                      <View style={styles.planCardFooter}>
                        <Text style={[styles.planAmount, active && styles.planTextActive]}>
                          ₦{item.amount.toLocaleString()}
                        </Text>
                        {item.fixedPrice && !active && (
                          <Text style={styles.fixedText}>Fixed</Text>
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
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
  planGridRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  planCard: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  planCardActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  planCardFooter: { marginTop: "auto", gap: spacing.xs },
  planName: { fontSize: typography.sizes.sm, color: colors.ink, fontWeight: typography.weights.semibold, lineHeight: 18 },
  durationBadge: { alignSelf: "flex-start", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.full, backgroundColor: colors.primarySoft },
  durationBadgeActive: { backgroundColor: "rgba(255,255,255,0.22)" },
  durationText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, color: colors.primary },
  durationTextActive: { color: colors.white },
  planAmount: { fontSize: typography.sizes.lg, color: colors.primary, fontWeight: typography.weights.bold },
  fixedText: { fontSize: typography.sizes.xs, color: colors.inkFaint },
  planTextActive: { color: colors.white },
  emptyText: { fontSize: typography.sizes.sm, color: colors.inkFaint, textAlign: "center", marginVertical: spacing.lg },
});
