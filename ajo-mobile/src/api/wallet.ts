import { authedFetch } from "./authed-client";
import type {
  WalletSummary,
  FundWalletResponse,
  BankListEntry,
  BankAccount,
  SetBankAccountPayload,
} from "../types/api";

export async function getWalletSummary(): Promise<WalletSummary> {
  return authedFetch<WalletSummary>("/wallet/me");
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