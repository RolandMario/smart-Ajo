import { formatCurrency } from "./format";
import type { PlatformBillTransaction } from "./types/api";

export type BadgeTone = "neutral" | "success" | "danger" | "warning" | "accent";

export function groupStatusTone(status: string): BadgeTone {
  switch (status) {
    case "active":
      return "success";
    case "completed":
      return "accent";
    case "terminated":
      return "danger";
    case "order_locked":
      return "warning";
    case "open_for_invites":
    default:
      return "neutral";
  }
}

export function groupStatusLabel(status: string): string {
  switch (status) {
    case "open_for_invites":
      return "Open for invites";
    case "order_locked":
      return "Order locked";
    case "active":
      return "Active";
    case "completed":
      return "Completed";
    case "terminated":
      return "Terminated";
    default:
      return status;
  }
}

export function inviteStatusTone(status: string): BadgeTone {
  switch (status) {
    case "accepted":
      return "success";
    case "declined":
      return "danger";
    case "pending":
    default:
      return "warning";
  }
}

export function payoutStatusTone(status: string): BadgeTone {
  return status === "collected" ? "success" : "neutral";
}

export function cycleStatusTone(status: string): BadgeTone {
  return status === "completed" ? "accent" : "warning";
}

export function transferStatusTone(status: string): BadgeTone {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    case "reversed":
      return "warning";
    case "pending":
    default:
      return "neutral";
  }
}

export function walletTxStatusTone(status: string): BadgeTone {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    case "pending":
    default:
      return "neutral";
  }
}

export function billStatusTone(status: string): BadgeTone {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "danger";
    case "pending":
    default:
      return "warning";
  }
}

export function billStatusLabel(status: string): string {
  switch (status) {
    case "success":
      return "Successful";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

export function billServiceTypeLabel(type: string): string {
  switch (type) {
    case "airtime":
      return "Airtime";
    case "data":
      return "Data";
    case "cable":
      return "Cable TV";
    case "electricity":
      return "Electricity";
    default:
      return type;
  }
}

export function billProviderLabel(provider: string): string {
  if (provider === "vtpass") return "VTPass";
  if (provider === "gladtidings") return "Gladtidings";
  return provider;
}

// ---- Bill receipt detail helpers -------------------------------------------

export interface BillReceiptRow {
  label: string;
  value: string;
}

/** Human label for a mobile network code (from the member app's pickers). */
export function billNetworkLabel(network?: string | null): string {
  switch (network?.toLowerCase()) {
    case "mtn":
      return "MTN";
    case "airtel":
      return "Airtel";
    case "glo":
      return "GLO";
    case "9mobile":
    case "etisalat":
      return "9Mobile";
    default:
      return network ? network.toUpperCase() : "—";
  }
}

/** Human label for a cable TV provider code. */
export function billCableBrandLabel(provider?: string | null): string {
  switch (provider?.toLowerCase()) {
    case "dstv":
      return "DSTV";
    case "gotv":
      return "GOtv";
    case "startimes":
      return "StarTimes";
    default:
      return provider ? provider.toUpperCase() : "—";
  }
}

/** Human label for a Nigerian electricity distribution company code. */
export function billDiscoLabel(disco?: string | null): string {
  if (!disco) return "—";
  const labels: Record<string, string> = {
    ikedc: "Ikeja Electric",
    ekedc: "Eko Electric",
    phed: "Port Harcourt Electric",
    jed: "Jos Electric",
    aedc: "Abuja Electric",
    kaedco: "Kano Electric",
    ibedc: "Ibadan Electric",
    eedc: "Enugu Electric",
    bedc: "Benin Electric",
    kedco: "Kaduna Electric",
    aba: "Aba Electric",
    yedc: "Yola Electric",
  };
  return labels[disco.toLowerCase()] ?? disco.toUpperCase();
}

function firstString(
  ...values: Array<unknown | undefined | null>
): string | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return undefined;
}

/**
 * Type-specific receipt rows for a bill transaction. Air, data, cable and
 * electricity each surface their own meaningful fields (network, data plan,
 * cable package/subscriber, electricity disco/token/customer, etc.), falling
 * back gracefully on older rows whose metadata predates the richer fields.
 */
export function billReceiptRows(tx: PlatformBillTransaction): BillReceiptRow[] {
  const metadata = tx.metadata ?? {};
  const details =
    (metadata.providerDetails as Record<string, unknown> | undefined) ?? {};

  const rows: BillReceiptRow[] = [
    { label: "Service", value: billServiceTypeLabel(tx.type) },
  ];

  switch (tx.type) {
    case "airtime":
      rows.push({
        label: "Network",
        value: billNetworkLabel(firstString(metadata.network)),
      });
      rows.push({
        label: "Recipient",
        value: firstString(metadata.recipient) ?? tx.recipient,
      });
      break;

    case "data":
      rows.push({
        label: "Network",
        value: billNetworkLabel(firstString(metadata.network)),
      });
      rows.push({
        label: "Plan",
        value:
          firstString(metadata.planName) ??
          firstString(metadata.variationCode) ??
          "—",
      });
      rows.push({
        label: "Recipient",
        value: firstString(metadata.recipient) ?? tx.recipient,
      });
      break;

    case "cable":
      rows.push({
        label: "Provider",
        value: billCableBrandLabel(firstString(metadata.serviceProvider)),
      });
      {
        const plan =
          firstString(metadata.packageName) ?? firstString(details.packageName);
        if (plan) rows.push({ label: "Package", value: plan });
      }
      rows.push({
        label: "Recipient",
        value: firstString(metadata.smartCardNumber) ?? tx.recipient,
      });
      {
        const customer =
          firstString(details.customerName) ??
          firstString(metadata.customerName);
        if (customer) rows.push({ label: "Customer", value: customer });
      }
      break;

    case "electricity":
      rows.push({
        label: "Disco",
        value: billDiscoLabel(firstString(metadata.disco)),
      });
      rows.push({
        label: "Meter",
        value: firstString(metadata.meterNumber) ?? tx.recipient,
      });
      if (metadata.meterType) {
        rows.push({
          label: "Meter type",
          value: String(metadata.meterType).toUpperCase(),
        });
      }
      {
        const token =
          firstString(details.token) ?? firstString(metadata.token);
        if (token) rows.push({ label: "Token", value: token });
      }
      {
        const units = firstString(details.units) ?? firstString(metadata.units);
        if (units) rows.push({ label: "Units", value: units });
      }
      {
        const customer =
          firstString(details.customerName) ??
          firstString(metadata.customerName);
        if (customer) rows.push({ label: "Customer", value: customer });
      }
      {
        const address =
          firstString(details.customerAddress) ??
          firstString(metadata.customerAddress);
        if (address) rows.push({ label: "Address", value: address });
      }
      {
        const outstanding =
          firstString(details.outstanding) ?? firstString(metadata.outstanding);
        if (outstanding) {
          const amount = Number(outstanding);
          rows.push({
            label: "Outstanding",
            value: Number.isFinite(amount)
              ? formatCurrency(amount)
              : outstanding,
          });
        }
      }
      break;

    default:
      break;
  }

  return rows;
}

export function walletTxTypeLabel(type: string): string {
  switch (type) {
    case "funding":
      return "Funding";
    case "contribution_debit":
      return "Contribution debit";
    case "contribution_refund":
      return "Contribution refund";
    case "service_fee_debit":
      return "Service fee debit";
    default:
      return type;
  }
}

export function groupWalletTxTypeLabel(type: string): string {
  switch (type) {
    case "contribution_credit":
      return "Contribution credit";
    case "payout_debit":
      return "Payout debit";
    case "payout_reversal_credit":
      return "Payout reversal credit";
    case "service_fee_credit":
      return "Service fee credit";
    default:
      return type;
  }
}

export function groupWalletTxTone(type: string): BadgeTone {
  switch (type) {
    case "contribution_credit":
    case "payout_reversal_credit":
    case "service_fee_credit":
      return "success";
    case "payout_debit":
      return "neutral";
    default:
      return "neutral";
  }
}
