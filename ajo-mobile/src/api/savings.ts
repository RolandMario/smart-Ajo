import { authedFetch } from "./authed-client";
import type {
  CreateSavingPlanPayload,
  SavingPlan,
  SavingPlanDetail,
} from "../types/api";

export async function listSavingPlans(): Promise<SavingPlan[]> {
  return authedFetch<SavingPlan[]>("/savings/plans");
}

export async function getSavingPlan(planId: string): Promise<SavingPlanDetail> {
  return authedFetch<SavingPlanDetail>(`/savings/plans/${planId}`);
}

export async function createSavingPlan(
  payload: CreateSavingPlanPayload,
): Promise<SavingPlanDetail> {
  return authedFetch<SavingPlanDetail>("/savings/plans", {
    method: "POST",
    body: payload,
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
