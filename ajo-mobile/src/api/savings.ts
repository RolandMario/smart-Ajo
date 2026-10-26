import { authedFetch } from "./authed-client";
import type {
  CreateSavingPlanPayload,
  SavingPlan,
  SavingPlanDetail,
} from "../types/api";

/** Rows per page in the plan's "Recent activity" ledger (server default). */
export const SAVING_ACTIVITY_PAGE_SIZE = 10;

export async function listSavingPlans(): Promise<SavingPlan[]> {
  return authedFetch<SavingPlan[]>("/savings/plans");
}

export async function getSavingPlan(
  planId: string,
  page = 1,
  limit = SAVING_ACTIVITY_PAGE_SIZE,
): Promise<SavingPlanDetail> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return authedFetch<SavingPlanDetail>(
    `/savings/plans/${planId}?${params.toString()}`,
  );
}

export async function createSavingPlan(
  payload: CreateSavingPlanPayload,
): Promise<SavingPlanDetail> {
  return authedFetch<SavingPlanDetail>("/savings/plans", {
    method: "POST",
    body: payload,
  });
}

export async function paySavingPlan(
  planId: string,
): Promise<SavingPlanDetail> {
  return authedFetch<SavingPlanDetail>(`/savings/plans/${planId}/pay`, {
    method: "POST",
  });
}

export async function withdrawSavingPlan(
  planId: string,
): Promise<SavingPlanDetail> {
  return authedFetch<SavingPlanDetail>(`/savings/plans/${planId}/withdraw`, {
    method: "POST",
  });
}

export async function continueSavingPlan(
  planId: string,
): Promise<SavingPlanDetail> {
  return authedFetch<SavingPlanDetail>(`/savings/plans/${planId}/continue`, {
    method: "POST",
  });
}

export async function deleteSavingPlan(
  planId: string,
): Promise<{ deleted: boolean }> {
  return authedFetch<{ deleted: boolean }>(`/savings/plans/${planId}`, {
    method: "DELETE",
  });
}
