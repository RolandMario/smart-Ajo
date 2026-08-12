import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, FlatList, Modal } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BillsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { colors, radii, spacing, typography } from "../../theme";
import { validateSmartCard, listCablePlans } from "../../api/bills";
import { ApiError } from "../../api/api-error";

type Props = NativeStackScreenProps<BillsStackParamList, "CableSubscription">;

type CablePlan = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
};

const PROVIDERS = ["dstv", "gotv", "startimes"] as const;

export function CableSubscriptionScreen({ navigation }: Props) {
  const [provider, setProvider] = useState<string>("");
  const [smartCard, setSmartCard] = useState("");
  const [plans, setPlans] = useState<CablePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<CablePlan | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [validating, setValidating] = useState(false);
  const [verified, setVerified] = useState<{ name?: string; packageInfo?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCablePlans(prov: string) {
    setLoadingPlans(true);
    setPlans([]);
    setSelectedPlan(null);
    setError(null);
    try {
      const data = await listCablePlans(prov);
      setPlans(data);
    } catch (err) {
      let message = "Failed to load cable plans. Tap retry.";
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
    if (!provider) return;
    void loadCablePlans(provider);
  }, [provider]);

  async function handleVerify() {
    if (!provider || !smartCard.trim()) {
      setError("Select provider and enter smart card number");
      return;
    }
    setValidating(true);
    setError(null);
    setVerified(null);
    try {
      const result = await validateSmartCard(provider as any, smartCard);
      console.log('[CableSubscription] validateSmartCard response:', result);
      if (result.valid) {
        setVerified({ name: result.name, packageInfo: result.packageInfo });
      } else {
        setError(result.message || "Smart card could not be verified");
      }
    } catch (err) {
      console.error('[CableSubscription] validateSmartCard error:', err);
      setError("Verification failed. Try again.");
    } finally {
      setValidating(false);
    }
  }

  function handleContinue() {
    if (!verified) { setError("Verify smart card first"); return; }
    if (!selectedPlan) { setError("Select a subscription plan"); return; }
    navigation.navigate("BillConfirmation", {
      serviceType: "cable",
      provider,
      recipient: smartCard,
      amount: selectedPlan.amount,
      customerName: verified?.name,
      metadata: { smartCardNumber: smartCard, variationCode: selectedPlan.variationCode, packageName: selectedPlan.name },
    });
  }

  return (
    <Screen scrollable={false}>
      <Text style={styles.title}>Cable TV</Text>
      {error && <ErrorBanner message={error} />}
      <Text style={styles.label}>Provider</Text>
      <View style={styles.row}>
        {PROVIDERS.map((p) => (
          <Pressable key={p} style={({ pressed }) => [styles.chip, provider === p && styles.chipActive, pressed && { opacity: 0.8 }]} onPress={() => setProvider(p)}>
            <Text style={[styles.chipText, provider === p && styles.chipTextActive]}>{p.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <TextField label="Smart Card Number" placeholder="Enter smart card number" keyboardType="number-pad" value={smartCard} onChangeText={setSmartCard} />
      <Button title={validating ? "Verifying..." : "Verify"} onPress={handleVerify} disabled={!provider || !smartCard || validating} />
      {verified && (
        <View style={styles.verifiedCard}>
          <Text style={styles.verifiedLabel}>Verified: {verified.name}</Text>
          {verified.packageInfo && <Text style={styles.verifiedText}>{verified.packageInfo}</Text>}
        </View>
      )}
      {loadingPlans && <LoadingScreen />}
      {verified && plans.length > 0 && (
        <>
          <Text style={styles.label}>Select a plan</Text>
          <Pressable
            style={({ pressed }) => [styles.dropdown, pressed && { opacity: 0.8 }]}
            onPress={() => setPlansOpen(true)}
          >
            <Text style={selectedPlan ? styles.dropdownText : styles.dropdownPlaceholder}>
              {selectedPlan ? `${selectedPlan.name} — ₦${selectedPlan.amount.toLocaleString()}` : "Choose a plan…"}
            </Text>
            <Text style={styles.dropdownCaret}>▾</Text>
          </Pressable>

          <Modal
            visible={plansOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setPlansOpen(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setPlansOpen(false)} />
            <View style={styles.modalSheet}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select a plan</Text>
                <Pressable onPress={() => setPlansOpen(false)} hitSlop={12}>
                  <Text style={styles.modalClose}>✕</Text>
                </Pressable>
              </View>
              <FlatList
                data={plans}
                keyExtractor={(item) => item.variationCode}
                renderItem={({ item }) => {
                  const active = selectedPlan?.variationCode === item.variationCode;
                  return (
                    <Pressable
                      style={({ pressed }) => [styles.planItem, active && styles.planItemActive, pressed && { opacity: 0.8 }]}
                      onPress={() => {
                        setSelectedPlan(item);
                        setPlansOpen(false);
                      }}
                    >
                      <Text style={[styles.planName, active && styles.planTextActive]}>{item.name}</Text>
                      <Text style={[styles.planAmount, active && styles.planTextActive]}>₦{item.amount.toLocaleString()}</Text>
                    </Pressable>
                  );
                }}
              />
            </View>
          </Modal>

          <Button title="Continue" onPress={handleContinue} disabled={!selectedPlan} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold, color: colors.ink, marginBottom: spacing.lg },
  label: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.inkSoft, marginBottom: spacing.xs },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.ink },
  chipTextActive: { color: colors.white },
  verifiedCard: { backgroundColor: colors.successSoft, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.lg },
  verifiedLabel: { fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.success },
  verifiedText: { fontSize: typography.sizes.sm, color: colors.success, marginTop: spacing.xs },
  dropdown: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.line, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.lg, marginBottom: spacing.lg, backgroundColor: colors.surface },
  dropdownText: { fontSize: typography.sizes.base, color: colors.ink, fontWeight: typography.weights.medium },
  dropdownPlaceholder: { fontSize: typography.sizes.base, color: colors.inkSoft },
  dropdownCaret: { fontSize: typography.sizes.lg, color: colors.inkSoft },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, maxHeight: "70%", paddingBottom: spacing.xl },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  modalTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.ink },
  modalClose: { fontSize: typography.sizes.lg, color: colors.inkSoft, paddingHorizontal: spacing.sm },
  planItem: { flexDirection: "row", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.line },
  planItemActive: { backgroundColor: colors.primary },
  planName: { fontSize: typography.sizes.base, color: colors.ink, fontWeight: typography.weights.medium },
  planAmount: { fontSize: typography.sizes.base, color: colors.primary, fontWeight: typography.weights.semibold },
  planTextActive: { color: colors.white },
});
