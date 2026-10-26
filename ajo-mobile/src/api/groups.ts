import { authedFetch } from "./authed-client";
import type {
  MyGroupListItem,
  GroupDetail,
  GroupMember,
  Group,
  CreateGroupPayload,
  CreateGroupResponse,
  GroupSearchResult,
  JoinGroupResponse,
  LockRotationPayload,
  ContributionFrequency,
} from "../types/api";

export interface ContinueGroupPayload {
  contributionAmount?: number;
  frequency?: ContributionFrequency;
  totalSlots?: number;
}

export interface ContinueGroupResponse {
  group: Group;
  members: GroupMember[];
}

export async function listMyGroups(): Promise<MyGroupListItem[]> {
  return authedFetch<MyGroupListItem[]>("/groups");
}

export async function getGroupDetail(groupId: string): Promise<GroupDetail> {
  return authedFetch<GroupDetail>(`/groups/${groupId}`);
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  return authedFetch<GroupMember[]>(`/groups/${groupId}/members`);
}

export async function createGroup(dto: CreateGroupPayload): Promise<CreateGroupResponse> {
  return authedFetch<CreateGroupResponse>("/groups", {
    method: "POST",
    body: dto,
  });
}

export async function searchGroupByCode(code: string): Promise<GroupSearchResult> {
  return authedFetch<GroupSearchResult>(
    `/groups/search?code=${encodeURIComponent(code)}`,
  );
}

export async function joinGroupByCode(
  code: string,
): Promise<JoinGroupResponse> {
  return authedFetch<JoinGroupResponse>("/groups/join", {
    method: "POST",
    body: { code },
  });
}

export async function lockRotation(
  groupId: string,
  dto: LockRotationPayload,
): Promise<GroupMember[]> {
  return authedFetch<GroupMember[]>(`/groups/${groupId}/rotation/lock`, {
    method: "POST",
    body: dto,
  });
}

export async function updateGroup(
  groupId: string,
  dto: {
    name?: string;
    contributionAmount?: number;
    frequency?: ContributionFrequency;
    totalSlots?: number;
  },
): Promise<{ group: Group; members: GroupMember[] }> {
  return authedFetch<{ group: Group; members: GroupMember[] }>(
    `/groups/${groupId}`,
    {
      method: "PATCH",
      body: dto,
    },
  );
}

export async function continueGroup(
  groupId: string,
  dto: ContinueGroupPayload,
): Promise<ContinueGroupResponse> {
  return authedFetch<ContinueGroupResponse>(`/groups/${groupId}/continue`, {
    method: "POST",
    body: dto,
  });
}

export async function terminateGroup(
  groupId: string,
): Promise<{ groupId: string; status: string }> {
  return authedFetch<{ groupId: string; status: string }>(
    `/groups/${groupId}/terminate`,
    { method: "POST" },
  );
}