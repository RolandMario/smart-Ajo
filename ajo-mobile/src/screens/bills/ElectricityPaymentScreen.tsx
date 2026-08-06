import React, { useState } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BillsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { colors, radii, spacing, typography } from "../../theme";
import { validateMeter } from "../../api/bills";

type Props = NativeStackScreenProps<BillsStackParamList, "ElectricityPayment">;

const DISCOS = ["ikedc","ekedc","phed","jed","aedc","kaedco","ibedc","eedc","bedc","kedco","aba","yedc"];

export function ElectricityPaymentScreen({ navigation }: Props) {
  const [disco, setDisco] = useState("");
  const [meterNo, setMeterNo] = useState("");
  const [meterType, setMeterType] = useState<"prepaid"|"postpaid">("prepaid");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [validating, setValidating] = useState(false);
  const [verified, setVerified] = useState<{name?:string;address?:string}|null>(null);
  const [error, setError] = useState<string|null>(null);

  async function handleVerify() {
    if (!disco || !meterNo.trim()) { setError("Select disco and enter meter number"); return; }
    setValidating(true); setError(null); setVerified(null);
    try {
      const result = await validateMeter(disco, meterNo, meterType);
      console.log('[ElectricityPayment] validateMeter response:', result);
      if (result.valid) { setVerified({name:result.name,address:result.address}); }
      else { setError(result.message||"Meter could not be verified"); }
    } catch (err) {
      console.error('[ElectricityPayment] validateMeter error:', err);
      setError("Verification failed");
    }
    finally { setValidating(false); }
  }

  function handleContinue() {
    if (!verified) { setError("Verify meter first"); return; }
    const n = Number(amount);
    if (n < 100) { setError("Minimum amount is ₦100"); return; }
    if (!phone || phone.length < 10) { setError("Enter a valid phone number"); return; }
    navigation.navigate("BillConfirmation", {
      serviceType: "electricity", provider: disco, recipient: meterNo, amount: n,
      customerName: verified?.name,
      metadata: { disco, meterNumber: meterNo, meterType, phone },
    });
  }

  return (
    <Screen>
      <Text style={styles.title}>Electricity</Text>
      {error && <ErrorBanner message={error} />}
      <Text style={styles.label}>Distribution Company</Text>
      <View style={styles.row}>{DISCOS.slice(0,6).map((d)=>(
        <Pressable key={d} style={({pressed})=>[styles.chip,disco===d&&styles.chipActive,pressed&&{opacity:0.8}]} onPress={()=>setDisco(d)}>
          <Text style={[styles.chipText,disco===d&&styles.chipTextActive]}>{d.toUpperCase()}</Text>
        </Pressable>
      ))}</View>
      <View style={styles.row}>{DISCOS.slice(6).map((d)=>(
        <Pressable key={d} style={({pressed})=>[styles.chip,disco===d&&styles.chipActive,pressed&&{opacity:0.8}]} onPress={()=>setDisco(d)}>
          <Text style={[styles.chipText,disco===d&&styles.chipTextActive]}>{d.toUpperCase()}</Text>
        </Pressable>
      ))}</View>
      <TextField label="Meter Number" placeholder="Enter meter number" keyboardType="number-pad" value={meterNo} onChangeText={setMeterNo} />
      <Text style={styles.label}>Meter Type</Text>
      <View style={styles.row}>{(["prepaid","postpaid"] as const).map((t)=>(
        <Pressable key={t} style={({pressed})=>[styles.chip,meterType===t&&styles.chipActive,pressed&&{opacity:0.8}]} onPress={()=>setMeterType(t)}>
          <Text style={[styles.chipText,meterType===t&&styles.chipTextActive]}>{t.toUpperCase()}</Text>
        </Pressable>
      ))}</View>
      <Button title={validating?"Verifying...":"Verify Meter"} onPress={handleVerify} disabled={!disco||!meterNo||validating} />
      {verified && (
        <View style={styles.verifiedCard}>
          <Text style={styles.verifiedLabel}>Verified: {verified.name}</Text>
          {verified.address && <Text style={styles.verifiedText}>{verified.address}</Text>}
        </View>
      )}
      {verified && (
        <>
          <TextField label="Amount (₦)" placeholder="Enter amount" keyboardType="number-pad" value={amount} onChangeText={setAmount} />
          <TextField label="Phone Number" placeholder="08012345678" keyboardType="phone-pad" value={phone} onChangeText={setPhone} maxLength={11} />
          <Button title="Continue" onPress={handleContinue} disabled={!amount||!phone||Number(amount)<100} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {fontSize:typography.sizes.xxl,fontWeight:typography.weights.bold,color:colors.ink,marginBottom:spacing.lg},
  label: {fontSize:typography.sizes.sm,fontWeight:typography.weights.medium,color:colors.inkSoft,marginBottom:spacing.xs},
  row: {flexDirection:"row",flexWrap:"wrap",gap:spacing.sm,marginBottom:spacing.md},
  chip: {paddingHorizontal:spacing.md,paddingVertical:spacing.xs,borderRadius:radii.full,borderWidth:1,borderColor:colors.line,backgroundColor:colors.surface},
  chipActive: {backgroundColor:colors.primary,borderColor:colors.primary},
  chipText: {fontSize:typography.sizes.xs,fontWeight:typography.weights.semibold,color:colors.ink},
  chipTextActive: {color:colors.white},
  verifiedCard: {backgroundColor:colors.successSoft,padding:spacing.md,borderRadius:radii.md,marginBottom:spacing.lg},
  verifiedLabel: {fontSize:typography.sizes.base,fontWeight:typography.weights.semibold,color:colors.success},
  verifiedText: {fontSize:typography.sizes.sm,color:colors.success,marginTop:spacing.xs},
});
