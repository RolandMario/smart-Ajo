import "server-only";
import { authedFetch } from "@/lib/api/authed-client";
import type {
  BillCatalogStatus,
  PaginatedBillServicePlans,
  BillServiceType,
  BillStatus,
  PaginatedBillTransactions,
  PlatformBillTransaction,
} from "@/lib/types/api";

/**
 * Reads for the Bills admin screen (Server Components only — the JWT never
 * reaches the browser). See lib/data/admins.ts for the same pattern.
 */

/** Sync status + plan counts per bill category (VTpass is the only provider). */
export async function getBillsCatalog(): Promise<BillCatalogStatus[]> {
  return authedFetch<BillCatalogStatus[]>("/admin/bills/catalog");
}

export interface ListBillsPlansParams {
  serviceType?: BillServiceType;
  page?: number;
  limit?: number;
}

export async function listBillsPlans(
  params: ListBillsPlansParams = {},
): Promise<PaginatedBillServicePlans> {
  const query = new URLSearchParams();
  if (params.serviceType) query.set("serviceType", params.serviceType);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return authedFetch<PaginatedBillServicePlans>(`/admin/bills/plans${qs ? `?${qs}` : ""}`);
}

export interface ListBillTransactionsParams {
  serviceType?: BillServiceType;
  status?: BillStatus;
  userId?: string;
  page?: number;
  limit?: number;
}

/** Every bill transaction on the platform (all users), newest first. */
export async function listBillTransactions(
  params: ListBillTransactionsParams = {},
): Promise<PaginatedBillTransactions> {
  const query = new URLSearchParams();
  if (params.serviceType) query.set("serviceType", params.serviceType);
  if (params.status) query.set("status", params.status);
  if (params.userId) query.set("userId", params.userId);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return authedFetch<PaginatedBillTransactions>(
    `/admin/bills/transactions${qs ? `?${qs}` : ""}`,
  );
}

/** Full receipt for a single bill transaction (customer identity included). */
export async function getBillTransaction(id: string): Promise<PlatformBillTransaction> {
  return authedFetch<PlatformBillTransaction>(
    `/admin/bills/transactions/${encodeURIComponent(id)}`,
  );
}