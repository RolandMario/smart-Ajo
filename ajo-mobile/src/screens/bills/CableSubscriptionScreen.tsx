import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, FlatList, Modal } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BillsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { SubpageHeader } from "../../components/SubpageHeader";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { colors, radii, spacing, typography } from "../../theme";
import { validateSmartCard, listCablePlans } from "../../api/bills";
import { ApiError } from "../../api/api-error";
import type { CablePlan } from "../../types/api";

type Props = NativeStackScreenProps<BillsStackParamList, "CableSubscription">;

const PROVIDERS = ["dstv", "gotv", "startimes"] as const;
type CableProvider = (typeof PROVIDERS)[number];

/**
 * VTpass bouquet names usually carry the price already ("DStv Padi N4,400",
 * "GOtv Smallie - monthly N1900"), so only append ours when it is missing.
 */
function planLabel(plan: CablePlan) {
  const raw = String(plan.amount);
  const formatted = plan.amount.toLocaleString();
  const shown = plan.name.includes(formatted) || plan.name.includes(raw);
  return shown ? plan.name : `${plan.name} — ₦${formatted}`;
}

export function CableSubscriptionScreen({ navigation }: Props) {
  const [provider, setProvider] = useState<CableProvider | "">("");
  const [smartCard, setSmartCard] = useState("");
  const [plans, setPlans] = useState<CablePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<CablePlan | null>(null);
  const [plansOpen, setPlansOpen] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [validating, setValidating] = useState(false);
  const [verified, setVerified] = useState<{
    name?: string;
    packageInfo?: string;
    /** VTpass' `Renewal_Amount` for the decoder's current bouquet. */
    renewalAmount?: number;
  } | null>(null);
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
    // Defer past the effect body so the loading state lands on the next frame
    // instead of synchronously within the effect.
    const timer = setTimeout(() => void loadCablePlans(provider), 0);
    return () => clearTimeout(timer);
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
      const result = await validateSmartCard(provider, smartCard.trim());
      const name = result.name ?? result.customerName;
      if (result.valid && name) {
        setVerified({
          name,
          packageInfo: result.packageInfo,
          renewalAmount: result.outstanding,
        });
      } else {
        setError(result.message || "Smart card could not be verified");
      }
    } catch (err) {
      // Show the provider's own reason ("Smartcard/Decoder Number … invalid")
      // instead of a generic failure, which hides the real cause.
      setError(err instanceof ApiError ? err.message : "Verification failed. Try again.");
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

  /**
   * Renews the bouquet the decoder is already on — no plan to pick. The amount
   * shown here is VTpass' `Renewal_Amount` for this smart card, which is what
   * the server charges (and what the confirmation screen shows).
   */
  function handleRenew() {
    if (!verified || !provider) { setError("Verify smart card first"); return; }
    if (!verified.renewalAmount) { setError("Renewal amount unavailable. Select a plan instead."); return; }
    navigation.navigate("BillConfirmation", {
      serviceType: "cable",
      provider,
      recipient: smartCard,
      amount: verified.renewalAmount,
      customerName: verified.name,
      metadata: { smartCardNumber: smartCard, renewal: true, packageName: verified.packageInfo },
    });
  }

  return (
    <Screen scrollable={false}>
      <SubpageHeader title="Cable TV" onBack={() => navigation.goBack()} />
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
          {verified.packageInfo && (
            <Text style={styles.verifiedText}>Current plan: {verified.packageInfo}</Text>
          )}
          {verified.renewalAmount ? (
            <View style={styles.renewRow}>
              <Text style={styles.verifiedText}>
                Renewal: ₦{verified.renewalAmount.toLocaleString()}
              </Text>
              <Pressable
                style={({ pressed }) => [styles.renewButton, pressed && { opacity: 0.8 }]}
                onPress={handleRenew}
                hitSlop={8}
              >
                <Text style={styles.renewButtonText}>Renew</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.verifiedText}>
              No active subscription to renew — choose a plan below.
            </Text>
          )}
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
              {selectedPlan ? planLabel(selectedPlan) : "Choose a plan…"}
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
  label: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.forestLightInkSoft, marginBottom: spacing.xs },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.lg },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, borderWidth: 1, borderColor: colors.forestLightLine, backgroundColor: colors.white },
  chipActive: { backgroundColor: colors.forestAction, borderColor: colors.forestAction },
  chipText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.forestLightInk },
  chipTextActive: { color: colors.white },
  verifiedCard: { backgroundColor: colors.successSoft, padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.lg },
  verifiedLabel: { fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, color: colors.success },
  verifiedText: { fontSize: typography.sizes.sm, color: colors.success, marginTop: spacing.xs },
  renewRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, marginTop: spacing.sm },
  renewButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radii.full, backgroundColor: colors.forestAction },
  renewButtonText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.white },
  dropdown: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: colors.forestLightLine, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.lg, marginBottom: spacing.lg, backgroundColor: colors.white },
  dropdownText: { fontSize: typography.sizes.base, color: colors.forestLightInk, fontWeight: typography.weights.medium },
  dropdownPlaceholder: { fontSize: typography.sizes.base, color: colors.forestLightInkSoft },
  dropdownCaret: { fontSize: typography.sizes.lg, color: colors.forestLightInkSoft },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: colors.white, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, maxHeight: "70%", paddingBottom: spacing.xl },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.forestLightLine },
  modalTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.forestLightInk },
  modalClose: { fontSize: typography.sizes.lg, color: colors.forestLightInkSoft, paddingHorizontal: spacing.sm },
  planItem: { flexDirection: "row", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.forestLightLine },
  planItemActive: { backgroundColor: colors.forestAction },
  planName: { fontSize: typography.sizes.base, color: colors.forestLightInk, fontWeight: typography.weights.medium },
  planAmount: { fontSize: typography.sizes.base, color: colors.forestAction, fontWeight: typography.weights.semibold },
  planTextActive: { color: colors.white },
});
