import { authedFetch } from "./authed-client";
import type {
  WalletSummary,
  FundWalletResponse,
  BankListEntry,
  BankAccount,
  SetBankAccountPayload,
  PaginatedWalletTransactions,
  DedicatedAccount,
} from "../types/api";

export async function getWalletSummary(): Promise<WalletSummary> {
  return authedFetch<WalletSummary>("/wallet/me");
}

export async function listWalletTransactions(
  page = 1,
  limit = 20,
): Promise<PaginatedWalletTransactions> {
  return authedFetch<PaginatedWalletTransactions>(
    `/wallet/transactions?page=${page}&limit=${limit}`,
  );
}

export async function initializeFunding(amount: number): Promise<FundWalletResponse> {
  return authedFetch<FundWalletResponse>("/wallet/fund/initialize", {
    method: "POST",
    body: { amount },
  });
}

export async function verifyFunding(reference: string): Promise<WalletSummary> {
  return authedFetch<WalletSummary>(`/wallet/fund/verify/${reference}`);
}

/** Returns the member's Paystack Dedicated Virtual Account, creating it on first use. */
export async function getDedicatedAccount(): Promise<DedicatedAccount> {
  return authedFetch<DedicatedAccount>("/wallet/dedicated-account");
}

/** Best-effort request for a new virtual account number. */
export async function refreshDedicatedAccount(): Promise<DedicatedAccount> {
  return authedFetch<DedicatedAccount>("/wallet/dedicated-account/refresh", {
    method: "POST",
  });
}

export async function listBanks(): Promise<BankListEntry[]> {
  return authedFetch<BankListEntry[]>("/wallet/banks");
}

export async function getBankAccount(): Promise<BankAccount | null> {
  return authedFetch<BankAccount | null>("/wallet/bank-account");
}

export async function setBankAccount(dto: SetBankAccountPayload): Promise<BankAccount> {
  return authedFetch<BankAccount>("/wallet/bank-account", {
    method: "POST",
    body: dto,
  });
}