import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, Pressable, FlatList } from "react-native";
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

const PROVIDERS = ["dstv", "gotv", "startimes"] as const;

export function CableSubscriptionScreen({ navigation }: Props) {
  const [provider, setProvider] = useState<string>("");
  const [smartCard, setSmartCard] = useState("");
  const [amount, setAmount] = useState("");
  const [plans, setPlans] = useState<Array<{ variationCode: string; name: string; amount: number; fixedPrice: boolean }>>([]);
  const [selectedPlan, setSelectedPlan] = useState<{ variationCode: string; name: string; amount: number } | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [validating, setValidating] = useState(false);
  const [verified, setVerified] = useState<{ name?: string; packageInfo?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadCablePlans(prov: string) {
    setLoadingPlans(true);
    setPlans([]);
    setSelectedPlan(null);
    setAmount("");
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
    const numAmount = Number(amount);
    if (numAmount < 100) { setError("Minimum amount is ₦100"); return; }
    navigation.navigate("BillConfirmation", {
      serviceType: "cable",
      provider,
      recipient: smartCard,
      amount: numAmount,
      customerName: verified?.name,
      metadata: { smartCardNumber: smartCard, selectedPlan: selectedPlan?.variationCode },
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
      {plans.length > 0 && (
        <>
          <Text style={styles.label}>Available Plans</Text>
          <FlatList
            data={plans}
            keyExtractor={(item) => item.variationCode}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.planItem, selectedPlan?.variationCode === item.variationCode && styles.planItemActive, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  setSelectedPlan(item);
                  setAmount(String(item.amount));
                }}
              >
                <Text style={[styles.planName, selectedPlan?.variationCode === item.variationCode && styles.planTextActive]}>{item.name}</Text>
                <Text style={[styles.planAmount, selectedPlan?.variationCode === item.variationCode && styles.planTextActive]}>₦{item.amount}</Text>
              </Pressable>
            )}
          />
        </>
      )}
      {verified && (
        <>
          <TextField label="Amount (₦)" placeholder="Enter amount" keyboardType="number-pad" value={amount} onChangeText={setAmount} />
          <Button title="Continue" onPress={handleContinue} disabled={!amount || Number(amount) < 100} />
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
  planItem: { flexDirection: "row", justifyContent: "space-between", padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, marginBottom: spacing.sm },
  planItemActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  planName: { fontSize: typography.sizes.sm, color: colors.ink, fontWeight: typography.weights.medium },
  planAmount: { fontSize: typography.sizes.sm, color: colors.primary, fontWeight: typography.weights.semibold },
  planTextActive: { color: colors.white },
});
