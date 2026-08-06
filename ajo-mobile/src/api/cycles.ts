import { authedFetch } from "./authed-client";
import type {
  CycleWithPaidCount,
  CurrentCycleResponse,
} from "../types/api";

export async function listCycles(groupId: string): Promise<CycleWithPaidCount[]> {
  return authedFetch<CycleWithPaidCount[]>(`/groups/${groupId}/cycles`);
}

export async function getCurrentCycle(groupId: string): Promise<CurrentCycleResponse> {
  return authedFetch<CurrentCycleResponse>(`/groups/${groupId}/cycles/current`);
}

export async function activateGroup(groupId: string): Promise<CurrentCycleResponse> {
  return authedFetch<CurrentCycleResponse>(`/groups/${groupId}/activate`, {
    method: "POST",
  });
}

export async function collectContributions(
  groupId: string,
  cycleId: string,
): Promise<{ results: { userId: string; success: boolean }[] } & CurrentCycleResponse> {
  return authedFetch<{ results: { userId: string; success: boolean }[] } & CurrentCycleResponse>(
    `/groups/${groupId}/cycles/${cycleId}/collect-contributions`,
    { method: "POST" },
  );
}

export async function initiatePayout(
  groupId: string,
  cycleId: string,
): Promise<unknown> {
  return authedFetch<unknown>(`/groups/${groupId}/cycles/${cycleId}/payout`, {
    method: "POST",
  });
}