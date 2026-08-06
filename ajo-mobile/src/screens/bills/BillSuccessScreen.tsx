import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BillsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<BillsStackParamList, "BillSuccess">;

export function BillSuccessScreen({ navigation, route }: Props) {
  const { serviceType, amount, recipient } = route.params;
  return (
    <Screen>
      <View style={styles.container}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.title}>Payment Successful</Text>
        <Text style={styles.subtitle}>{serviceType.toUpperCase()} - ₦{amount.toLocaleString()}</Text>
        <Text style={styles.detail}>Sent to: {recipient}</Text>
        <Button title="Done" onPress={() => navigation.navigate("BillServices")} style={styles.button} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl },
  checkmark: { fontSize: 64, color: colors.success, marginBottom: spacing.lg },
  title: { fontSize: typography.sizes.xxl, fontWeight: typography.weights.bold, color: colors.ink, marginBottom: spacing.sm },
  subtitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.ink, marginBottom: spacing.md },
  detail: { fontSize: typography.sizes.base, color: colors.inkSoft, marginBottom: spacing.xxl },
  button: { width: "100%" },
});
