import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BillsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { colors, radii, spacing, typography } from "../../theme";
import { purchaseAirtime, purchaseData, purchaseCable, purchaseElectricity } from "../../api/bills";

type Props = NativeStackScreenProps<BillsStackParamList, "BillConfirmation">;

export function BillConfirmationScreen({ navigation, route }: Props) {
  const { serviceType, provider, recipient, amount, customerName, metadata } = route.params;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      switch (serviceType) {
        case "airtime": await purchaseAirtime({ phone: recipient, amount, network: String(metadata?.network) }); break;
        case "data": await purchaseData({ phone: recipient, dataPlanId: String(metadata?.variationCode), network: provider }); break;
        case "cable": await purchaseCable({ serviceProvider: provider as any, smartCardNumber: recipient, amount, variationCode: String(metadata?.variationCode ?? "") }); break;
        case "electricity": await purchaseElectricity({ disco: String(metadata?.disco), meterNumber: String(metadata?.meterNumber), meterType: String(metadata?.meterType) as any, amount, phone: String(metadata?.phone) }); break;
      }
      navigation.replace("BillSuccess", { serviceType, reference: "completed", amount, recipient });
    } catch (err: any) {
      setError(err.message || "Payment failed. Try again.");
    } finally { setLoading(false); }
  }

  return (
    <Screen>
      <Text style={styles.title}>Confirm Payment</Text>
      {error && <ErrorBanner message={error} />}
      <View style={styles.card}>
        <Text style={styles.label}>Service</Text>
        <Text style={styles.value}>{serviceType.toUpperCase()}</Text>
        <Text style={styles.label}>Provider</Text>
        <Text style={styles.value}>{provider.toUpperCase()}</Text>
        <Text style={styles.label}>Recipient</Text>
        <Text style={styles.value}>{recipient}</Text>
        {customerName && <><Text style={styles.label}>Customer</Text><Text style={styles.value}>{customerName}</Text></>}
        <Text style={styles.label}>Amount</Text>
        <Text style={styles.amount}>₦{amount.toLocaleString()}</Text>
      </View>
      <Button title={loading ? "Processing..." : "Pay Now"} onPress={handlePay} disabled={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold, color: colors.ink, marginBottom: spacing.lg },
  card: { backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.xl, marginBottom: spacing.xl },
  label: { fontSize: typography.sizes.xs, color: colors.inkSoft, marginTop: spacing.sm, marginBottom: spacing.xs, textTransform: "uppercase" as const },
  value: { fontSize: typography.sizes.base, color: colors.ink, fontWeight: typography.weights.medium },
  amount: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold, color: colors.primary },
});
