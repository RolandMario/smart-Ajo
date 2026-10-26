import { authedFetch } from "./authed-client";
import type {
  CreateDonationGroupPayload,
  DonatePayload,
  DonationGroupDetail,
  DonationGroupsResponse,
  DonationListResponse,
  DonationPayoutDestination,
  DonationPayout,
  DonationPayoutListResponse,
  DonationPayoutSetup,
  DonationGroup,
  DonationPoolTermination,
  SetDonationPayoutAccountPayload,
} from "../types/api";

/** Rows per page in the pool donation / payout history (server default). */
export const DONATION_PAGE_SIZE = 10;

/** Every pool the member belongs to + dashboard totals. */
export async function listDonationGroups(): Promise<DonationGroupsResponse> {
  return authedFetch<DonationGroupsResponse>("/donations/groups");
}

export async function createDonationGroup(
  payload: CreateDonationGroupPayload,
): Promise<DonationGroupDetail> {
  return authedFetch<DonationGroupDetail>("/donations/groups", {
    method: "POST",
    body: payload,
  });
}

/** Joins a pool by its shared Group ID. Idempotent server-side. */
export async function joinDonationGroup(
  groupId: string,
): Promise<DonationGroupDetail> {
  return authedFetch<DonationGroupDetail>("/donations/groups/join", {
    method: "POST",
    body: { groupId },
  });
}

export async function getDonationGroup(
  groupId: string,
): Promise<DonationGroupDetail> {
  return authedFetch<DonationGroupDetail>(`/donations/groups/${groupId}`);
}

/** Donates for the current period (one donation per member per period). */
export async function donateToGroup(
  groupId: string,
  payload: DonatePayload = {},
): Promise<DonationGroupDetail> {
  return authedFetch<DonationGroupDetail>(
    `/donations/groups/${groupId}/donate`,
    { method: "POST", body: payload },
  );
}

export async function listDonationHistory(
  groupId: string,
  page = 1,
  limit = DONATION_PAGE_SIZE,
): Promise<DonationListResponse> {
  return authedFetch<DonationListResponse>(
    `/donations/groups/${groupId}/donations?page=${page}&limit=${limit}`,
  );
}

/** Admin-only: payout history + escrow balance. */
export async function listDonationPayouts(
  groupId: string,
  page = 1,
  limit = DONATION_PAGE_SIZE,
): Promise<DonationPayoutListResponse> {
  return authedFetch<DonationPayoutListResponse>(
    `/donations/groups/${groupId}/payouts?page=${page}&limit=${limit}`,
  );
}

/** Admin-only: pays escrow out; omit `amount` to withdraw it all. */
export async function initiateDonationPayout(
  groupId: string,
  amount?: number,
): Promise<{
  payout: DonationPayout | null;
  group: DonationGroup | null;
  destination: DonationPayoutDestination;
}> {
  return authedFetch(`/donations/groups/${groupId}/payouts`, {
    method: "POST",
    body: amount === undefined ? {} : { amount },
  });
}

/** Admin-only: pool override + the admin's own account + effective account. */
export async function getDonationPayoutAccount(
  groupId: string,
): Promise<DonationPayoutSetup> {
  return authedFetch<DonationPayoutSetup>(
    `/donations/groups/${groupId}/payout-account`,
  );
}

/** Admin-only: set the pool override, or `useAdminAccount` to clear it. */
export async function setDonationPayoutAccount(
  groupId: string,
  payload: SetDonationPayoutAccountPayload,
): Promise<DonationPayoutSetup> {
  return authedFetch<DonationPayoutSetup>(
    `/donations/groups/${groupId}/payout-account`,
    { method: "PUT", body: payload },
  );
}

/**
 * Casts or withdraws the caller's vote for the pool to be terminated. The
 * server rejects members who have not paid 100% of their contribution.
 */
export async function setPoolTerminationVote(
  groupId: string,
  vote: boolean,
): Promise<DonationGroupDetail> {
  return authedFetch<DonationGroupDetail>(
    `/donations/groups/${groupId}/termination-vote`,
    { method: "PUT", body: { vote } },
  );
}

/**
 * Terminates the pool. Admin-only: the server re-checks that 2/3 of the fully
 * paid members voted yes AND that every naira donated has been paid out, so
 * this can only succeed once the button is enabled.
 *
 * Termination is a permanent delete — the pool, its donations, memberships,
 * payouts and escrow movements are removed, so the caller must leave the
 * detail screen afterwards (the pool 404s from here on).
 */
export async function terminatePoolGroup(
  groupId: string,
): Promise<DonationPoolTermination> {
  return authedFetch<DonationPoolTermination>(
    `/donations/groups/${groupId}/terminate`,
    { method: "POST", body: {} },
  );
}
