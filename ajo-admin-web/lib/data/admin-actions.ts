"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/api/client";
import { authedFetch } from "@/lib/api/authed-client";
import { getAccessToken } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/api-error";
import type { PlatformAdminListItem } from "@/lib/types/api";

export interface CreateAdminActionResult {
  error?: string;
  success?: boolean;
}

/**
 * Server Action backing the "create admin" form on /admins. Surfaces
 * ajo-server's actual validation/conflict messages (e.g. "A user with
 * this email already exists") rather than a generic failure, since
 * those are exactly the messages an admin needs to fix their input.
 */
export async function createAdminAction(
  _prevState: CreateAdminActionResult,
  formData: FormData,
): Promise<CreateAdminActionResult> {
  const email = formData.get("email");
  const phone = formData.get("phone");
  const password = formData.get("password");
  const name = formData.get("name");

  if (typeof email !== "string" || !email) {
    return { error: "Email is required." };
  }
  if (typeof phone !== "string" || !phone) {
    return { error: "Phone is required." };
  }
  if (typeof password !== "string" || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { error: "Your session has expired. Please sign in again." };
  }

  try {
    await apiFetch<PlatformAdminListItem>("/admin/admins", {
      method: "POST",
      accessToken,
      body: {
        email,
        phone,
        password,
        name: typeof name === "string" && name ? name : undefined,
      },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    return { error: "Couldn't reach the server. Check your connection and try again." };
  }

  revalidatePath("/admins");
  return { success: true };
}

/**
 * Toggles an admin's active status. Called directly from a form's
 * action (no useActionState) since there's no form input to preserve on
 * error — just a confirm-and-toggle button per row.
 */
export async function setAdminActiveAction(adminId: string, isActive: boolean): Promise<void> {
  await authedFetch(`/admin/admins/${adminId}/active`, {
    method: "PATCH",
    body: { isActive },
  });

  revalidatePath("/admins");
}
