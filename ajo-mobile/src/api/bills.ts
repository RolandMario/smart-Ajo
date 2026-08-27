import { authedFetch } from "./authed-client";
import type { BillTransaction, AirtimePayload, DataPayload, CablePayload, ElectricityPayload, DataPlan, ValidationResult, BillServiceType } from "../types/api";

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

export async function purchaseElectricity(payload: ElectricityPayload): Promise<BillTransaction> {
  return authedFetch<BillTransaction>("/bills/electricity", { method: "POST", body: payload });
}

export async function listDataPlans(network: string): Promise<DataPlan[]> {
  return authedFetch<DataPlan[]>(`/bills/data-plans?network=${encodeURIComponent(network)}`);
}

export async function listCablePlans(provider: string): Promise<
  { variationCode: string; name: string; amount: number; fixedPrice: boolean }[]
> {
  return authedFetch(`/bills/cable-plans?provider=${encodeURIComponent(provider)}`);
}

export async function getBillHistory(): Promise<BillTransaction[]> {
  return authedFetch<BillTransaction[]>("/bills/history");
}

export async function getReceipt(reference: string): Promise<BillTransaction> {
  return authedFetch<BillTransaction>(`/bills/receipts/${encodeURIComponent(reference)}`);
}
