import { authedFetch } from "./authed-client";
import type { BillTransaction, AirtimePayload, DataPayload, CablePayload, RenewCablePayload, ElectricityPayload, DataPlan, CablePlan, CashbackQuote, ValidationResult, BillServiceType } from "../types/api";

/** Service categories the admin has enabled for the member app. */
export async function getBillServices(): Promise<BillServiceType[]> {
  return authedFetch<BillServiceType[]>("/bills/services");
}

export async function validateMeter(disco: string, meterNumber: string, meterType: "prepaid" | "postpaid"): Promise<ValidationResult> {
  return authedFetch<ValidationResult>("/bills/validate/meter", { method: "POST", body: { disco, meterNumber, meterType } });
}

export async function validateSmartCard(serviceProvider: "dstv" | "gotv" | "startimes", smartCardNumber: string): Promise<ValidationResult> {
  return authedFetch<ValidationResult>("/bills/validate/smart-card", { method: "POST", body: { serviceProvider, smartCardNumber } });
}

export async function purchaseAirtime(payload: AirtimePayload): Promise<BillTransaction> {
  return authedFetch<BillTransaction>("/bills/airtime", { method: "POST", body: payload });
}

export async function purchaseData(payload: DataPayload): Promise<BillTransaction> {
  return authedFetch<BillTransaction>("/bills/data", { method: "POST", body: payload });
}

export async function purchaseCable(payload: CablePayload): Promise<BillTransaction> {
  return authedFetch<BillTransaction>("/bills/cable", { method: "POST", body: payload });
}

/**
 * Renews the bouquet the decoder is already on. The server prices it from
 * VTpass' `Renewal_Amount` for that smart card, so nothing but the card is sent.
 */
export async function renewCable(payload: RenewCablePayload): Promise<BillTransaction> {
  return authedFetch<BillTransaction>("/bills/cable/renew", { method: "POST", body: payload });
}

export async function purchaseElectricity(payload: ElectricityPayload): Promise<BillTransaction> {
  return authedFetch<BillTransaction>("/bills/electricity", { method: "POST", body: payload });
}

export async function listDataPlans(network: string): Promise<DataPlan[]> {
  return authedFetch<DataPlan[]>(`/bills/data-plans?network=${encodeURIComponent(network)}`);
}

export async function listCablePlans(provider: string): Promise<CablePlan[]> {
  return authedFetch<CablePlan[]>(`/bills/cable-plans?provider=${encodeURIComponent(provider)}`);
}

/**
 * Cashback a purchase about to be confirmed will earn — the banner on the
 * confirm screen. Data/cable are re-priced server-side from the plan code.
 */
export async function getCashbackQuote(params: {
  serviceType: BillServiceType;
  provider?: string;
  variationCode?: string;
  amount?: number;
  packageName?: string;
}): Promise<CashbackQuote> {
  const query = new URLSearchParams({ serviceType: params.serviceType });
  if (params.provider) query.set("provider", params.provider);
  if (params.variationCode) query.set("variationCode", params.variationCode);
  if (params.amount != null) query.set("amount", String(params.amount));
  if (params.packageName) query.set("packageName", params.packageName);
  return authedFetch<CashbackQuote>(`/bills/cashback-quote?${query.toString()}`);
}

/**
 * The member's bill receipts, newest first (the server returns at most 100).
 * `serviceType` narrows the list to one category — the filter tabs on the
 * history screen; omit it for every service.
 */
export async function getBillHistory(
  serviceType?: BillServiceType,
): Promise<BillTransaction[]> {
  if (!serviceType) return authedFetch<BillTransaction[]>("/bills/history");
  return authedFetch<BillTransaction[]>(
    `/bills/history?serviceType=${serviceType}`,
  );
}

export async function getReceipt(reference: string): Promise<BillTransaction> {
  return authedFetch<BillTransaction>(`/bills/receipts/${encodeURIComponent(reference)}`);
}
