import "server-only";
import { authedFetch } from "@/lib/api/authed-client";
import type { GroupStatus, PaginatedGroups, PlatformGroupDetail } from "@/lib/types/api";

export interface ListGroupsParams {
  search?: string;
  status?: GroupStatus;
  page?: number;
  limit?: number;
}

export async function listGroups(params: ListGroupsParams = {}): Promise<PaginatedGroups> {
  const query = new URLSearchParams();

  if (params.search) query.set("search", params.search);
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return authedFetch<PaginatedGroups>(`/admin/groups${qs ? `?${qs}` : ""}`);
}

export async function getGroupDetail(id: string): Promise<PlatformGroupDetail> {
  return authedFetch<PlatformGroupDetail>(`/admin/groups/${id}`);
}

export async function updateServiceFee(groupId: string, serviceFee: number): Promise<PlatformGroupDetail> {
  return authedFetch<PlatformGroupDetail>(`/admin/groups/${groupId}/service-fee`, {
    method: 'PATCH',
    body: { serviceFee },
  });
}

export async function updateGroupAutoCollect(groupId: string, enabled: boolean): Promise<PlatformGroupDetail> {
  return authedFetch<PlatformGroupDetail>(`/admin/groups/${groupId}/auto-collect`, {
    method: 'PATCH',
    body: { enabled },
  });
}
