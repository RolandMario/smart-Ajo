import { formatNaira } from "./format";

/**
 * Type-specific bill receipt fields shared by the wallet receipts and the bill
 * success screen. Each service category renders its own meaningful rows —
 * airtime → network, data → network + plan size, cable → provider + package +
 * subscriber, electricity → product (disco) + meter + token + units + phone +
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

/** "IKEJA ELECTRIC" → "Ikeja Electric". */
function titleCaseWords(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The vended token as it should read on a receipt.
 *
 * VTpass labels it inside the value (`"token": "Token : 2636…"`) and a bare
 * 20-digit run is unreadable, so the label is dropped and long digit runs are
 * grouped in fours — the way the token is read out when typing it into a meter.
 */
function receiptToken(value?: string | null): string | undefined {
  const token = value?.replace(/^\s*token\s*[:-]?\s*/i, "").trim();
  if (!token) return undefined;
  return /^\d{12,}$/.test(token) ? token.replace(/(\d{4})(?=\d)/g, "$1 ") : token;
}

/** "79.9 kWh" → "79.9": the row label already carries the unit. */
function receiptUnits(value?: string | null): string | undefined {
  const units = value?.replace(/\s*kwh\s*$/i, "").trim();
  return units || undefined;
}

/**
 * The electricity product as it should read on a receipt. VTpass returns the
 * trading name (`disco_name`, e.g. "IKEJA ELECTRIC"), which beats our own
 * mapping; rows without it (older receipts, or a provider that echoed back the
 * bare code "IKEDC") fall back to the human label for the disco code.
 */
function discoProductLabel(
  discoName?: string | null,
  discoCode?: string | null,
): string {
  const name = discoName?.trim();
  // A bare code in caps reads worse than our own mapping.
  if (name && /\s/.test(name)) return titleCaseWords(name);
  return discoLabel(discoCode);
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
          firstString(metadata.packageName) ??
          firstString(metadata.planName) ??
          firstString(details.packageName);
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
      // Prepaid receipts lead with what was bought (the disco's trading name,
      // e.g. "Ikeja Electric"), then the meter/token it was delivered to.
      rows.push({
        label: "Product",
        value: discoProductLabel(
          firstString(details.discoName) ?? firstString(metadata.discoName),
          firstString(metadata.disco),
        ),
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
        const token = receiptToken(
          firstString(details.token) ?? firstString(metadata.token),
        );
        if (token) rows.push({ label: "Token", value: token });
      }
      {
        // Providers send the count with its unit ("79.9 kWh") — the label below
        // carries it, so only the number is shown.
        const units = receiptUnits(
          firstString(details.units) ?? firstString(metadata.units),
        );
        if (units) rows.push({ label: "Units (kWh)", value: units });
      }
      {
        // The prepaid token also goes out by SMS, so members need to see which
        // line received it.
        const phone =
          firstString(metadata.phone) ?? firstString(details.phone);
        if (phone) rows.push({ label: "Phone", value: phone });
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