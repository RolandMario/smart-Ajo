import "server-only";
import { authedFetch } from "@/lib/api/authed-client";
import type { PaginatedUsers, PlatformUserDetail, Role } from "@/lib/types/api";

export interface ListUsersParams {
  search?: string;
  role?: Role;
  page?: number;
  limit?: number;
}

export async function listUsers(params: ListUsersParams = {}): Promise<PaginatedUsers> {
  const query = new URLSearchParams();

  if (params.search) query.set("search", params.search);
  if (params.role) query.set("role", params.role);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return authedFetch<PaginatedUsers>(`/admin/users${qs ? `?${qs}` : ""}`);
}

export async function getUserDetail(id: string): Promise<PlatformUserDetail> {
  return authedFetch<PlatformUserDetail>(`/admin/users/${id}`);
}
