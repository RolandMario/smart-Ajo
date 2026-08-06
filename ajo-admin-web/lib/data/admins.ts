import "server-only";
import { authedFetch } from "@/lib/api/authed-client";
import type { PlatformAdminListItem } from "@/lib/types/api";

export async function listAdmins(): Promise<PlatformAdminListItem[]> {
  return authedFetch<PlatformAdminListItem[]>("/admin/admins");
}
