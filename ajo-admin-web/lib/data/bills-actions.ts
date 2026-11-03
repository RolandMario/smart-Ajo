"use server";

import { revalidatePath } from "next/cache";
import { authedFetch } from "@/lib/api/authed-client";
import { ApiError } from "@/lib/api/api-error";
import type { SyncBillPlansResult } from "@/lib/types/api";

const messageFrom = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? error.message : fallback;

/**
 * Server Action: trigger a VTpass plan synchronisation for a service category
 * and return the summary so the UI can show how many plans were added/updated.
 */
export async function syncBillsPlansAction(
  serviceType: string,
): Promise<SyncBillPlansResult & { error?: string }> {
  try {
    const result = await authedFetch<SyncBillPlansResult>(
      `/admin/bills/catalog/${serviceType}/sync`,
      { method: "POST" },
    );
    revalidatePath("/bills");
    revalidatePath("/bills/plans");
    return result;
  } catch (error) {
    return {
      serviceType,
      provider: "vtpass",
      total: 0,
      created: 0,
      updated: 0,
      removed: 0,
      error: messageFrom(error, "Sync failed. See the server logs."),
    };
  }
}

/** Server Action: toggle a single plan on/off for the member app. */
export async function setBillPlanActiveAction(
  id: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  try {
    await authedFetch(`/admin/bills/plans/${id}/active`, {
      method: "PATCH",
      body: { isActive },
    });
  } catch (error) {
    return { error: messageFrom(error, "Couldn't update this plan.") };
  }
  revalidatePath("/bills/plans");
  revalidatePath("/bills");
  return {};
}

/**
 * Server Action: set the cashback percentage a plan pays back to the member.
 * `0` switches cashback off for that plan; decimals are allowed (0.5 = ½%).
 */
export async function setBillPlanCashbackAction(
  id: string,
  cashbackPercent: number,
): Promise<{ error?: string }> {
  try {
    await authedFetch(`/admin/bills/plans/${id}/cashback`, {
      method: "PATCH",
      body: { cashbackPercent },
    });
  } catch (error) {
    return {
      error: messageFrom(error, "Couldn't update this plan's cashback."),
    };
  }
  revalidatePath("/bills/plans");
  return {};
}