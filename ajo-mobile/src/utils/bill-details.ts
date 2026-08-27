import { formatNaira } from "./format";

/**
 * Type-specific bill receipt fields shared by the wallet receipts and (once
 * wired up) any bill success screen. Each service category renders its own
 * meaningful rows — airtime → network, data → network + plan size, cable →
 * provider + package + subscriber, electricity → disco + meter + token +
 * customer — while falling back gracefully on rows whose metadata predates
 * the richer fields (e.g. no `providerDetails` from the provider response).
 */

export interface BillReceiptRow {
  label: string;
  value: string;
}

/** Minimal source shape — the stored BillTransaction satisfies this. */
export interface BillReceiptSource {
  type: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
}

const SERVICE_LABELS: Record<string, string> = {
  airtime: "Airtime",
  data: "Data",
  cable: "Cable TV",
  electricity: "Electricity",
};

function firstString(
  ...values: (unknown | undefined | null)[]
): string | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return String(value);
    }
  }
  return undefined;
}

function networkLabel(network?: string | null): string {
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

function cableBrandLabel(provider?: string | null): string {
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

function discoLabel(disco?: string | null): string {
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

/**
 * Type-specific receipt rows for a bill transaction. Returns an empty array
 * for anything that isn't one of the four bill services.
 */
export function billReceiptRows(tx: BillReceiptSource): BillReceiptRow[] {
  const metadata = tx.metadata ?? {};
  const details =
    (metadata.providerDetails as Record<string, unknown> | undefined) ?? {};

  const rows: BillReceiptRow[] = [
    {
      label: "Service",
      value: SERVICE_LABELS[tx.type] ?? tx.type.charAt(0).toUpperCase() + tx.type.slice(1),
    },
  ];

  switch (tx.type) {
    case "airtime":
      rows.push({
        label: "Network",
        value: networkLabel(firstString(metadata.network)),
      });
      rows.push({
        label: "Recipient",
        value: firstString(metadata.recipient) ?? tx.recipient ?? "—",
      });
      break;

    case "data":
      rows.push({
        label: "Network",
        value: networkLabel(firstString(metadata.network)),
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
        value: firstString(metadata.recipient) ?? tx.recipient ?? "—",
      });
      break;

    case "cable":
      rows.push({
        label: "Provider",
        value: cableBrandLabel(firstString(metadata.serviceProvider)),
      });
      {
        const plan =
          firstString(metadata.packageName) ?? firstString(details.packageName);
        if (plan) rows.push({ label: "Package", value: plan });
      }
      rows.push({
        label: "Recipient",
        value: firstString(metadata.smartCardNumber) ?? tx.recipient ?? "—",
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
        value: discoLabel(firstString(metadata.disco)),
      });
      rows.push({
        label: "Meter",
        value: firstString(metadata.meterNumber) ?? tx.recipient ?? "—",
      });
      {
        const meterType = firstString(metadata.meterType);
        if (meterType) {
          rows.push({ label: "Meter type", value: meterType.toUpperCase() });
        }
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
            value: Number.isFinite(amount) ? formatNaira(amount) : outstanding,
          });
        }
      }
      break;

    default:
      break;
  }

  return rows;
}