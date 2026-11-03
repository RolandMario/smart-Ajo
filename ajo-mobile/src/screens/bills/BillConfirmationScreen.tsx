import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BillsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { SubpageHeader } from "../../components/SubpageHeader";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ApiError } from "../../api/api-error";
import {
  getCashbackQuote,
  purchaseAirtime,
  purchaseCable,
  purchaseData,
  purchaseElectricity,
  renewCable,
} from "../../api/bills";
import { getWalletSummary } from "../../api/wallet";
import { formatNaira, formatNairaExact } from "../../utils/format";
import { colors, radii, spacing, typography } from "../../theme";
import type { BillPaymentSource, WalletSummary } from "../../types/api";

type Props = NativeStackScreenProps<BillsStackParamList, "BillConfirmation">;

/** Title on the confirm screen, per category (matches the purchase screen). */
const SERVICE_TITLES: Record<string, string> = {
  airtime: "Buy Airtime",
  data: "Buy Data",
  cable: "Cable TV",
  electricity: "Electricity",
};

function titled(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/**
 * The bundle name without its network prefix — "MTN 110MB Daily Plan (1 Day)"
 * reads as "110MB Daily Plan (1 Day)" under a "Network: MTN" row.
 */
function bundleName(name: string, provider: string): string {
  return name.replace(new RegExp(`^${provider}\\s+`, "i"), "").trim();
}

/**
 * Validity pulled from a plan name ("110MB Daily Plan (1 Day)" → "Daily"),
 * or `null` when the name doesn't state one — better to omit the row than to
 * invent a validity VTpass never promised.
 */
function planValidity(name?: string): string | null {
  if (!name) return null;
  const n = ` ${name.toLowerCase().replace(/-/g, " ")} `;

  if (/\b(year|yearly|annual|12\s*months?)\b/.test(n)) return "Yearly";
  if (/\b(week|weekly)\b/.test(n)) {
    return /\b2\s*weeks?\b/.test(n) ? "2 Weeks" : "Weekly";
  }
  if (/\btwo\s*days?\b|\b2\s*days?\b/.test(n)) return "2 Days";
  if (/\b(daily|1\s*day)\b/.test(n)) return "Daily";

  const months = n.match(/(\d+)\s*months?/);
  if (months) {
    return months[1] === "1" ? "1 Month" : `${months[1]} Months`;
  }
  const days = n.match(/(\d+)\s*days?/);
  if (days) return `${days[1]} Days`;
  if (/\bmonthly\b/.test(n)) return "Monthly";

  return null;
}

/**
 * Confirm payment — the last stop before a bill is paid.
 *
 * Redesigned to the mock: the purchase summarised as labelled rows, a "Pay
 * from" choice between the main wallet and the cashback wallet, the cashback
 * this purchase will earn, then one "Pay ₦…" button and a Cancel link.
 *
 * The cashback figure is quoted by the server (`GET /bills/cashback-quote`),
 * which re-prices data/cable from its own catalogue — the banner therefore
 * always matches what the purchase will actually credit.
 */
export function BillConfirmationScreen({ navigation, route }: Props) {
  const { serviceType, provider, recipient, amount, customerName, metadata } =
    route.params;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [cashback, setCashback] = useState(0);
  const [paymentSource, setPaymentSource] =
    useState<BillPaymentSource>("main");

  /** True when the cable screen came from its "Renew" button (no plan picked). */
  const isRenewal = serviceType === "cable" && metadata?.renewal === true;
  const variationCode = metadata?.variationCode
    ? String(metadata.variationCode)
    : undefined;
  const planName = metadata?.planName ? String(metadata.planName) : undefined;
  const packageName = metadata?.packageName
    ? String(metadata.packageName)
    : undefined;

  // Wallet balances for the "Pay from" tiles.
  useEffect(() => {
    let cancelled = false;
    getWalletSummary()
      .then((summary) => {
        if (cancelled) return;
        setWallet(summary);
        // Land on the wallet that can actually pay, so a member whose main
        // wallet is short isn't sent into an "Insufficient balance" error.
        if (
          summary.balance < amount &&
          summary.cashbackBalance >= amount
        ) {
          setPaymentSource("cashback");
        }
      })
      .catch(() => {
        /* The tiles fall back to "—"; paying still works. */
      });
    return () => {
      cancelled = true;
    };
  }, [amount]);

  // What this purchase will earn. Best-effort: no banner if the quote fails.
  useEffect(() => {
    let cancelled = false;
    const request =
      serviceType === "data"
        ? { serviceType, provider, variationCode }
        : serviceType === "cable"
          ? isRenewal
            ? { serviceType, provider, amount, packageName }
            : { serviceType, provider, variationCode, amount }
          : { serviceType, provider, amount };

    getCashbackQuote(request)
      .then((quote) => {
        if (!cancelled) setCashback(quote.cashback ?? 0);
      })
      .catch(() => {
        if (!cancelled) setCashback(0);
      });

    return () => {
      cancelled = true;
    };
  }, [serviceType, provider, amount, variationCode, packageName, isRenewal]);

  /**
   * The detail rows. Each category shows what the member actually bought —
   * the confirm screen is the last place they can catch a wrong number or
   * bouquet before the money leaves the wallet.
   */
  const rows = useMemo(() => {
    const list: { label: string; value: string }[] = [];

    if (serviceType === "airtime") {
      list.push(
        { label: "Network", value: provider.toUpperCase() },
        { label: "Phone", value: recipient },
      );
    } else if (serviceType === "data") {
      list.push(
        { label: "Network", value: provider.toUpperCase() },
        {
          label: "Bundle",
          value: planName ? bundleName(planName, provider) : "Data bundle",
        },
      );
      const validity = planValidity(planName);
      if (validity) list.push({ label: "Validity", value: validity });
      list.push({ label: "Phone", value: recipient });
    } else if (serviceType === "cable") {
      list.push(
        { label: "Provider", value: provider.toUpperCase() },
        {
          label: isRenewal ? "Current bouquet" : "Bouquet",
          value:
            packageName ??
            (isRenewal ? "Current subscription" : "Selected bouquet"),
        },
        { label: "Smartcard", value: recipient },
      );
      if (customerName) list.push({ label: "Subscriber", value: customerName });
    } else {
      list.push(
        { label: "Disco", value: provider.toUpperCase() },
        { label: "Meter number", value: recipient },
      );
      if (metadata?.meterType) {
        list.push({
          label: "Meter type",
          value: titled(String(metadata.meterType)),
        });
      }
      if (customerName) list.push({ label: "Customer", value: customerName });
    }

    list.push({ label: "Amount", value: formatNaira(amount) });
    return list;
  }, [serviceType, provider, recipient, amount, customerName, metadata, planName, packageName, isRenewal]);

  /** "MTN · 110MB Daily Plan (1 Day)" — the mock's line under the title. */
  const summaryLine = useMemo(() => {
    const detail =
      serviceType === "data" && planName
        ? bundleName(planName, provider)
        : serviceType === "cable" && packageName
          ? packageName
          : recipient;
    return `${provider.toUpperCase()} · ${detail}`;
  }, [serviceType, provider, recipient, planName, packageName]);

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      let tx: {
        reference: string;
        provider?: string;
        metadata?: Record<string, unknown>;
        createdAt?: string;
        amount?: number;
      };
      switch (serviceType) {
        case "airtime":
          tx = await purchaseAirtime({
            phone: recipient,
            amount,
            network: String(metadata?.network ?? provider),
            paymentSource,
          });
          break;
        case "data":
          tx = await purchaseData({
            phone: recipient,
            dataPlanId: String(metadata?.variationCode),
            network: provider,
            paymentSource,
          });
          break;
        case "cable":
          tx = isRenewal
            ? await renewCable({
                serviceProvider: provider as any,
                smartCardNumber: recipient,
                customerName: customerName ?? undefined,
                // Lets the server refuse a price that moved after verification.
                expectedAmount: amount,
                paymentSource,
              })
            : await purchaseCable({
                serviceProvider: provider as any,
                smartCardNumber: recipient,
                amount,
                variationCode: String(metadata?.variationCode ?? ""),
                customerName: customerName ?? undefined,
                paymentSource,
              });
          break;
        case "electricity":
          // No phone is sent: VTpass requires one, so the server supplies the
          // member's account number (it is where the prepaid token SMS goes).
          tx = await purchaseElectricity({
            disco: String(metadata?.disco ?? provider),
            meterNumber: String(metadata?.meterNumber ?? recipient),
            meterType: String(metadata?.meterType) as any,
            amount,
            customerName: customerName ?? undefined,
            paymentSource,
          });
          break;
      }
      navigation.replace("BillSuccess", {
        serviceType,
        reference: tx.reference,
        // A renewal is priced by the provider (Renewal_Amount), so show what
        // was actually charged rather than the amount that was displayed.
        amount: tx.amount ?? amount,
        recipient,
        provider,
        // The provider response carries the electricity token/units and the
        // verified customer name, so the receipt renders them straight away.
        metadata: tx.metadata ?? metadata,
        createdAt: tx.createdAt,
      });
    } catch (err) {
      let message = "Payment failed. Try again.";
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
      setLoading(false);
    }
  }

  const cashbackBalance = wallet?.cashbackBalance ?? 0;
  const mainBalance = wallet?.balance ?? 0;
  // A cashback balance that can't cover this bill is shown but not selectable.
  const cashbackUnavailable = wallet != null && cashbackBalance < amount;

  return (
    <Screen>
      <SubpageHeader
        title="Confirm payment"
        onBack={() => navigation.goBack()}
      />
      {error && <ErrorBanner message={error} />}

      <Text style={styles.serviceTitle}>
        {SERVICE_TITLES[serviceType] ?? "Bill payment"}
      </Text>
      <Text style={styles.summaryLine} numberOfLines={2}>
        {summaryLine}
      </Text>

      {/* ---- Purchase details ---------------------------------- */}
      <View style={styles.card}>
        {rows.map((row, index) => (
          <View
            key={row.label}
            style={[styles.row, index > 0 && styles.rowDivider]}
          >
            <Text style={styles.rowLabel}>{row.label}</Text>
            <Text style={styles.rowValue} numberOfLines={2}>
              {row.value}
            </Text>
          </View>
        ))}

        <View style={[styles.row, styles.rowDivider, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatNaira(amount)}</Text>
        </View>
      </View>

      {/* ---- Pay from ------------------------------------------ */}
      <View style={styles.payFromCard}>
        <Text style={styles.payFromTitle}>Pay from</Text>

        <View style={styles.walletOptions}>
          <WalletOption
            label="Main wallet"
            balance={mainBalance}
            selected={paymentSource === "main"}
            onPress={() => setPaymentSource("main")}
            disabled={loading}
          />
          <WalletOption
            label="Cashback"
            balance={cashbackBalance}
            selected={paymentSource === "cashback"}
            onPress={() => setPaymentSource("cashback")}
            disabled={loading || cashbackUnavailable}
            hint={cashbackUnavailable ? "Not enough" : undefined}
          />
        </View>
      </View>

      {/* ---- What this purchase earns -------------------------- */}
      {cashback > 0 ? (
        <View style={styles.cashbackBanner}>
          <Text style={styles.cashbackText}>
            🎉{"You'll earn "}
            <Text style={styles.cashbackAmount}>
              {formatNairaExact(cashback)}
            </Text>
            {" cashback when this purchase succeeds."}
          </Text>
        </View>
      ) : null}

      <Button
        title={loading ? "Processing..." : `Pay ${formatNaira(amount)}`}
        onPress={handlePay}
        disabled={loading}
      />

      <Button
        title="Cancel"
        variant="ghost"
        onPress={() => navigation.goBack()}
        disabled={loading}
        style={styles.cancel}
      />
    </Screen>
  );
}

/**
 * One "Pay from" tile: a radio, the wallet's name and its balance. The
 * selected tile is tinted green so the choice reads at a glance.
 */
function WalletOption({
  label,
  balance,
  selected,
  onPress,
  disabled,
  hint,
}: {
  label: string;
  balance: number;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: Boolean(disabled) }}
      accessibilityLabel={`${label}, ${formatNairaExact(balance)}`}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.walletOption,
        selected && styles.walletOptionSelected,
        disabled && styles.walletOptionDisabled,
        pressed && !disabled && styles.walletOptionPressed,
      ]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>

      <View style={styles.walletText}>
        <Text
          style={[styles.walletLabel, selected && styles.walletLabelSelected]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text style={styles.walletBalance} numberOfLines={1}>
          {formatNairaExact(balance)}
        </Text>
        {hint ? <Text style={styles.walletHint}>{hint}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ---- Headings ----------------------------------------------------------
  serviceTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.forestAction,
    marginBottom: spacing.xs,
  },
  summaryLine: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },

  // ---- Purchase details card --------------------------------------------
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.forestLightLine,
  },
  rowLabel: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
  },
  rowValue: {
    flexShrink: 1,
    textAlign: "right",
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  totalRow: {
    paddingVertical: spacing.lg,
  },
  totalLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  totalValue: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.forestAction,
  },

  // ---- Pay from ---------------------------------------------------------
  payFromCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  payFromTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    marginBottom: spacing.md,
  },
  walletOptions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  walletOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    // Keeps a long balance from widening the tile past its half of the row.
    minWidth: 0,
  },
  walletOptionSelected: {
    borderColor: colors.forestAction,
    backgroundColor: colors.forestLightCard,
  },
  walletOptionDisabled: {
    opacity: 0.45,
  },
  walletOptionPressed: {
    opacity: 0.85,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: radii.full,
    borderWidth: 2,
    borderColor: colors.forestLightLine,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    borderColor: colors.forestAction,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
    backgroundColor: colors.forestAction,
  },
  walletText: {
    flex: 1,
    minWidth: 0,
  },
  walletLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  walletLabelSelected: {
    color: colors.forestAction,
  },
  walletBalance: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    marginTop: 2,
  },
  walletHint: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    marginTop: 2,
  },

  // ---- Cashback banner --------------------------------------------------
  cashbackBanner: {
    backgroundColor: colors.forestLightPill,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  cashbackText: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    lineHeight: 22,
  },
  cashbackAmount: {
    fontWeight: typography.weights.bold,
    color: colors.forestAction,
  },

  // ---- Actions ----------------------------------------------------------
  cancel: {
    marginTop: spacing.sm,
  },
});



