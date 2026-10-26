import { authedFetch } from "./authed-client";
import type {
  CycleWithPaidCount,
  CurrentCycleResponse,
  EscrowAccount,
  GroupPayout,
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

/**
 * Member pays their own contribution from their wallet. The server debits
 * the wallet (amount + service fee), credits the group's escrow account and
 * marks the contribution PAID in one transaction.
 */
export async function payContributionFromWallet(
  groupId: string,
  contributionId: string,
): Promise<CurrentCycleResponse> {
  return authedFetch<CurrentCycleResponse>(
    `/groups/${groupId}/contributions/${contributionId}/pay`,
    { method: "POST" },
  );
}

/**
 * Member reports they've sent a bank transfer into the group's escrow
 * account. The contribution becomes `awaiting_confirmation` until the group
 * admin verifies it.
 */
export async function notifyBankTransferPayment(
  groupId: string,
  contributionId: string,
  claimedReference?: string,
): Promise<CurrentCycleResponse> {
  return authedFetch<CurrentCycleResponse>(
    `/groups/${groupId}/contributions/${contributionId}/notify-transfer`,
    { method: "POST", body: { claimedReference } },
  );
}

/** Group admin confirms a claimed bank transfer. */
export async function confirmContribution(
  groupId: string,
  contributionId: string,
): Promise<CurrentCycleResponse> {
  return authedFetch<CurrentCycleResponse>(
    `/groups/${groupId}/contributions/${contributionId}/confirm`,
    { method: "POST" },
  );
}

/** Group admin rejects a claimed bank transfer (fee refunded to the member). */
export async function rejectContribution(
  groupId: string,
  contributionId: string,
  reason?: string,
): Promise<CurrentCycleResponse> {
  return authedFetch<CurrentCycleResponse>(
    `/groups/${groupId}/contributions/${contributionId}/reject`,
    { method: "POST", body: { reason } },
  );
}

/** The group's escrow (DVA) details, or null while not yet provisioned. */
export async function getEscrowAccount(groupId: string): Promise<EscrowAccount | null> {
  return authedFetch<EscrowAccount | null>(`/groups/${groupId}/escrow-account`);
}

/**
 * Admin-only. Sends the cycle's pooled funds to the recipient's bank account.
 * Returns the Payout record — `status` is "pending" while Paystack's webhook
 * is still finalizing the transfer. A transfer that Paystack rejects throws,
 * and the server refunds the group wallet so it can be retried.
 */
export async function initiatePayout(
  groupId: string,
  cycleId: string,
): Promise<GroupPayout> {
  return authedFetch<GroupPayout>(`/groups/${groupId}/cycles/${cycleId}/payout`, {
    method: "POST",
  });
}