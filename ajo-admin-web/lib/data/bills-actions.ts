"use server";

import { revalidatePath } from "next/cache";
import { authedFetch } from "@/lib/api/authed-client";
import { ApiError } from "@/lib/api/api-error";
import type { SyncBillPlansResult, BillProviderKey } from "@/lib/types/api";

export interface ProviderFormState {
  error?: string;
  success?: boolean;
}

const messageFrom = (error: unknown, fallback: string): string =>
  error instanceof ApiError ? error.message : fallback;

/**
 * Server Action: set which provider is active for a service category.
 * Form-bound via useActionState on the Bills screen.
 */
export async function setBillProviderAction(
  _prev: ProviderFormState,
  formData: FormData,
): Promise<ProviderFormState> {
  const serviceType = formData.get("serviceType");
  const provider = formData.get("provider");

  if (
    typeof serviceType !== "string" ||
    typeof provider !== "string" ||
    !serviceType ||
    (provider !== "vtpass" && provider !== "gladtidings")
  ) {
    return { error: "Pick a service category and a provider." };
  }

  try {
    await authedFetch(`/admin/bills/providers/${serviceType}`, {
      method: "POST",
      body: { provider: provider as BillProviderKey },
    });
  } catch (error) {
    return { error: messageFrom(error, "Couldn't update the provider.") };
  }

  revalidatePath("/bills");
  revalidatePath("/bills/plans");
  return { success: true };
}

/**
 * Server Action: trigger a plan synchronisation for a service category and
 * return the summary so the UI can show how many plans were added/updated.
 */
export async function syncBillsPlansAction(
  serviceType: string,
): Promise<SyncBillPlansResult & { error?: string }> {
  try {
    const result = await authedFetch<SyncBillPlansResult>(
      `/admin/bills/providers/${serviceType}/sync`,
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