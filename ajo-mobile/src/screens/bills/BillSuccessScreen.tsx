import React, { useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import type { BillsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<BillsStackParamList, "BillSuccess">;

const SERVICE_LABELS: Record<string, string> = {
  airtime: "Airtime",
  data: "Data",
  cable: "Cable TV",
  electricity: "Electricity",
};

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Resolves the Service label. For cable, show the cable brand (Dstv/Gotv/
 * Startimes) rather than the generic "Cable TV". */
function serviceLabel(serviceType: string, provider?: string): string {
  if (serviceType === "cable") {
    return provider ? toTitleCase(provider) : "Cable TV";
  }
  return SERVICE_LABELS[serviceType] ?? serviceType.toUpperCase();
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BillSuccessScreen({ navigation, route }: Props) {
  const {
    serviceType,
    amount,
    recipient,
    provider,
    reference,
    externalReference,
    createdAt,
  } = route.params;
  const receiptRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (!receiptRef.current) return;
    setSharing(true);
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Sharing isn't available on this device.");
        return;
      }
      const uri = await captureRef(receiptRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share Receipt",
        UTI: "public.png",
      });
    } catch (err: any) {
      Alert.alert("Couldn't share", err?.message || "Something went wrong while sharing.");
    } finally {
      setSharing(false);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        {/* Receipt — captured as the shared image */}
        <View ref={receiptRef} collapsable={false} style={styles.receipt}>
          {/* Sm@rtAjo header */}
          <View style={styles.brandRow}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoText}>A</Text>
            </View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandName}>Sm@rtAjo</Text>
              <Text style={styles.brandTagline}>Save Together, Grow Together</Text>
            </View>
          </View>
          <View style={styles.accentRule} />

          <Text style={styles.receiptTitle}>Payment Receipt</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>SUCCESSFUL</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.label}>Service</Text>
            <Text style={styles.value}>
              {serviceLabel(serviceType, provider)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Recipient</Text>
            <Text style={styles.value}>{recipient}</Text>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.amount}>₦{amount.toLocaleString()}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.label}>Reference</Text>
            <Text style={styles.value}>{reference}</Text>
          </View>
          {externalReference ? (
            <View style={styles.detailRow}>
              <Text style={styles.label}>External Ref</Text>
              <Text style={styles.value}>{externalReference}</Text>
            </View>
          ) : null}
          <View style={styles.detailRow}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatDate(createdAt)}</Text>
          </View>
        </View>

        <Button
          title={sharing ? "Preparing..." : "Share Receipt"}
          onPress={handleShare}
          loading={sharing}
          style={styles.button}
        />
        <Button
          title="Done"
          variant="secondary"
          onPress={() => navigation.navigate("BillServices")}
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "stretch",
    justifyContent: "center",
  },
  receipt: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  logoText: {
    fontSize: 30,
    fontWeight: typography.weights.bold,
    color: colors.white,
    lineHeight: 34,
  },
  brandTextWrap: {
    flex: 1,
  },
  brandName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  brandTagline: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.inkSoft,
    marginTop: 2,
  },
  accentRule: {
    height: 3,
    backgroundColor: colors.accent,
    borderRadius: 2,
    marginBottom: spacing.lg,
  },
  receiptTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  statusBadge: {
    alignSelf: "center",
    backgroundColor: colors.successSoft,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginBottom: spacing.lg,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.success,
    letterSpacing: 1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
    marginRight: spacing.md,
  },
  value: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
    textAlign: "right",
    flexShrink: 1,
  },
  amount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  button: {
    width: "100%",
    marginBottom: spacing.md,
  },
});
