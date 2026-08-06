import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BillsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<BillsStackParamList, "AirtimePurchase">;

const NETWORKS = ["mtn", "glo", "airtel", "9mobile"] as const;
const PRESETS = [50, 100, 200, 500, 1000];

export function AirtimePurchaseScreen({ navigation }: Props) {
  const [phone, setPhone] = useState("");
  const [network, setNetwork] = useState("");
  const [amount, setAmount] = useState(0);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleCustom(text: string) {
    setCustom(text);
    setAmount(Number(text) || 0);
  }

  function handleContinue() {
    setError(null);
    if (!phone.trim() || phone.length < 10) { setError("Enter a valid phone number"); return; }
    if (!network) { setError("Select a network"); return; }
    if (amount < 10) { setError("Minimum amount is ₦10"); return; }
    navigation.navigate("BillConfirmation", {
      serviceType: "airtime",
      provider: network,
      recipient: phone,
      amount,
      metadata: { network },
    });
  }

  return (
    <Screen>
      <Text style={styles.title}>Buy Airtime</Text>
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
      <Text style={styles.label}>Amount</Text>
      <View style={styles.row}>
        {PRESETS.map((a) => (
          <Pressable key={a} style={({ pressed }) => [styles.chip, amount === a && styles.chipActive, pressed && { opacity: 0.8 }]} onPress={() => { setAmount(a); setCustom(""); }}>
            <Text style={[styles.chipText, amount === a && styles.chipTextActive]}>₦{a}</Text>
          </Pressable>
        ))}
      </View>
      <TextField label="Or custom amount" placeholder="Enter amount" keyboardType="number-pad" value={custom} onChangeText={handleCustom} />
      <Button title="Continue" onPress={handleContinue} disabled={!phone || !network || amount < 10} />
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
});
