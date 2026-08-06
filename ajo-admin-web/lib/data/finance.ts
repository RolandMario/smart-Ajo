import "server-only";
import { authedFetch } from "@/lib/api/authed-client";
import type {
  PaginatedWalletTransactions,
  PaginatedPayouts,
  PaginatedGroupWalletTransactions,
  WalletTransactionType,
  WalletTransactionStatus,
  TransferStatus,
  GroupWalletTransactionType,
} from "@/lib/types/api";

export interface ListWalletTransactionsParams {
  type?: WalletTransactionType;
  status?: WalletTransactionStatus;
  userId?: string;
  page?: number;
  limit?: number;
}

export async function listWalletTransactions(
  params: ListWalletTransactionsParams = {},
): Promise<PaginatedWalletTransactions> {
  const query = new URLSearchParams();

  if (params.type) query.set("type", params.type);
  if (params.status) query.set("status", params.status);
  if (params.userId) query.set("userId", params.userId);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return authedFetch<PaginatedWalletTransactions>(
    `/admin/finance/wallet-transactions${qs ? `?${qs}` : ""}`,
  );
}

export interface ListPayoutsParams {
  status?: TransferStatus;
  groupId?: string;
  page?: number;
  limit?: number;
}

export async function listPayouts(params: ListPayoutsParams = {}): Promise<PaginatedPayouts> {
  const query = new URLSearchParams();

  if (params.status) query.set("status", params.status);
  if (params.groupId) query.set("groupId", params.groupId);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return authedFetch<PaginatedPayouts>(`/admin/finance/payouts${qs ? `?${qs}` : ""}`);
}

export interface ListGroupWalletTransactionsParams {
  type?: GroupWalletTransactionType;
  groupId?: string;
  page?: number;
  limit?: number;
}

export async function listGroupWalletTransactions(
  params: ListGroupWalletTransactionsParams = {},
): Promise<PaginatedGroupWalletTransactions> {
  const query = new URLSearchParams();

  if (params.type) query.set("type", params.type);
  if (params.groupId) query.set("groupId", params.groupId);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return authedFetch<PaginatedGroupWalletTransactions>(
    `/admin/finance/group-wallet-transactions${qs ? `?${qs}` : ""}`,
  );
}

export async function listServiceFeeTransactions(
  params: ListGroupWalletTransactionsParams = {},
): Promise<PaginatedGroupWalletTransactions> {
  const query = new URLSearchParams();

  query.set("type", "service_fee_credit");
  if (params.groupId) query.set("groupId", params.groupId);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  return authedFetch<PaginatedGroupWalletTransactions>(
    `/admin/finance/group-wallet-transactions${qs ? `?${qs}` : ""}`,
  );
}

// ---- Admin wallet (service fee accumulation & withdrawal) -------------------

export interface AdminWalletSummary {
  balance: number;
  currency: string;
  bankAccount: {
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    paystackRecipientCode: string;
  } | null;
  totalCommissionBalance: number;
  recentServiceFeeCredits: Array<{
    id: string;
    amount: number;
    balanceAfter: number;
    group?: { id: string; name: string };
    createdAt: string;
  }>;
  recentBillCommissionCredits: Array<{
    id: string;
    amount: number;
    balanceAfter: number;
    billType: string;
    userPaid: number;
    actualCost: number;
    createdAt: string;
  }>;
}

export interface AdminWithdrawResult {
  message: string;
  amount: number;
  transferCode: string;
  status: string;
}

export async function getAdminWallet(): Promise<AdminWalletSummary> {
  return authedFetch<AdminWalletSummary>("/admin/wallet");
}

export async function adminWithdraw(amount: number): Promise<AdminWithdrawResult> {
  return authedFetch<AdminWithdrawResult>("/admin/wallet/withdraw", {
    method: "POST",
    body: { amount },
  });
}

export async function getAdminBankAccount() {
  return authedFetch<{
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    paystackRecipientCode: string;
  } | null>("/admin/wallet/bank-account");
}

export async function setAdminBankAccount(dto: {
  accountNumber: string;
  bankCode: string;
  bankName: string;
}) {
  return authedFetch<{
    bankName: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    paystackRecipientCode: string;
  }>("/admin/wallet/bank-account", {
    method: "POST",
    body: dto,
  });
}

export async function listAdminBanks(): Promise<Array<{ name: string; code: string }>> {
  return authedFetch<Array<{ name: string; code: string }>>("/admin/wallet/banks");
}
