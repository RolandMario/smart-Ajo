/**
 * Types mirroring ajo-server's response shapes for the subset of data
 * the admin web app consumes. Kept hand-written (not generated) since
 * the backend is a separate repo — if the two drift, update here.
 */

export type Role = "platform_admin" | "user";

export interface AdminUser {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: AdminUser;
}

export type GroupStatus =
  | "open_for_invites"
  | "order_locked"
  | "active"
  | "completed"
  | "terminated";

export type ContributionFrequency = "daily" | "weekly" | "monthly";

export type RotationMethod = "manual" | "random";

export interface Group {
  _id: string;
  name: string;
  createdBy: string;
  contributionAmount: number;
  frequency: ContributionFrequency;
  totalSlots: number;
  rotationMethod: RotationMethod;
  status: GroupStatus;
  orderLockedAt?: string;
  startDate?: string;
  currentCycleNumber?: number | null;
  autoCollectEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InviteStatus = "pending" | "accepted" | "declined";
export type PayoutStatus = "pending" | "collected";

export interface GroupMember {
  _id: string;
  group: string;
  user: {
    _id: string;
    name?: string;
    phone: string;
    email?: string;
  };
  isGroupAdmin: boolean;
  inviteStatus: InviteStatus;
  position: number | null;
  payoutStatus: PayoutStatus;
  defaultCount: number;
  createdAt: string;
  updatedAt: string;
}

/** API error envelope thrown by NestJS's default exception filter. */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// ---- Platform admin: Users directory (sub-phase B) -------------------------

export interface PlatformUserListItem {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  role: Role;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isActive: boolean;
  hasBankAccount: boolean;
  createdAt: string;
}

export interface PaginatedUsers {
  users: PlatformUserListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface UserGroupSummary {
  groupId: string;
  groupName: string;
  groupStatus: GroupStatus | "unknown";
  isGroupAdmin: boolean;
  inviteStatus: InviteStatus;
  position: number | null;
  payoutStatus: PayoutStatus;
  defaultCount: number;
}

export interface PlatformUserDetail {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  role: Role;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
  isActive: boolean;
  bankAccount?: {
    bankName: string;
    accountNumber: string; // masked, e.g. "****1234"
    accountName: string;
  };
  wallet: {
    balance: number;
    currency: string;
  };
  groups: UserGroupSummary[];
  createdAt: string;
  updatedAt: string;
}

// ---- Platform admin: Groups directory (sub-phase C) -------------------------

export type CycleStatus = "open" | "completed";
export type TransferStatus = "pending" | "success" | "failed" | "reversed";

export interface PlatformGroupListItem {
  id: string;
  name: string;
  status: GroupStatus;
  contributionAmount: number;
  frequency: ContributionFrequency;
  totalSlots: number;
  rotationMethod: RotationMethod;
  autoCollectEnabled: boolean;
  currentCycleNumber: number | null;
  createdAt: string;
}

export interface PaginatedGroups {
  groups: PlatformGroupListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface GroupMemberStanding {
  groupMemberId: string;
  user: { id: string; name?: string; phone: string; email?: string };
  isGroupAdmin: boolean;
  inviteStatus: InviteStatus;
  position: number | null;
  payoutStatus: PayoutStatus;
  defaultCount: number;
}

export interface GroupCycleSummary {
  cycleId: string;
  cycleNumber: number;
  status: CycleStatus;
  dueDate: string;
  contributionAmount: number;
  totalSlots: number;
  paidCount: number;
  defaultedCount: number;
  pendingCount: number;
  completedAt?: string;
}

export interface GroupPayoutSummary {
  payoutId: string;
  cycleNumber: number;
  recipient: { id: string; name?: string; phone: string };
  amount: number;
  status: TransferStatus;
  failureReason?: string;
  completedAt?: string;
  createdAt: string;
}

export interface PlatformGroupDetail {
  id: string;
  name: string;
  status: GroupStatus;
  contributionAmount: number;
  frequency: ContributionFrequency;
  totalSlots: number;
  rotationMethod: RotationMethod;
  autoCollectEnabled: boolean;
  currentCycleNumber: number | null;
  orderLockedAt?: string;
  startDate?: string;
  centralWalletBalance: number;
  serviceFee: number;
  admin?: { id: string; name?: string; phone: string };
  members: GroupMemberStanding[];
  cycles: GroupCycleSummary[];
  payouts: GroupPayoutSummary[];
  createdAt: string;
  updatedAt: string;
}

// ---- Platform admin: Financial oversight (sub-phase D) ----------------------

export type WalletTransactionType = "funding" | "contribution_debit" | "contribution_refund" | "service_fee_debit";
export type WalletTransactionStatus = "pending" | "success" | "failed";
export type GroupWalletTransactionType =
  | "contribution_credit"
  | "payout_debit"
  | "payout_reversal_credit"
  | "service_fee_credit";

export interface PlatformWalletTransaction {
  id: string;
  user: { id: string; name?: string; phone: string };
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference: string;
  group?: { id: string; name: string };
  createdAt: string;
}

export interface PaginatedWalletTransactions {
  transactions: PlatformWalletTransaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PlatformPayout {
  id: string;
  group: { id: string; name: string };
  cycleNumber: number;
  recipient: { id: string; name?: string; phone: string };
  initiatedBy: { id: string; name?: string; phone: string };
  amount: number;
  status: TransferStatus;
  failureReason?: string;
  paystackReference: string;
  completedAt?: string;
  createdAt: string;
}

export interface PaginatedPayouts {
  payouts: PlatformPayout[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PlatformGroupWalletTransaction {
  id: string;
  group: { id: string; name: string };
  type: GroupWalletTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export interface PaginatedGroupWalletTransactions {
  transactions: PlatformGroupWalletTransaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---- Platform admin: Admin wallet (service fee accumulation & withdrawal) ----

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
  recentServiceFeeCredits: Array<{
    id: string;
    amount: number;
    balanceAfter: number;
    group?: { id: string; name: string };
    createdAt: string;
  }>;
}

export interface AdminWithdrawResult {
  message: string;
  amount: number;
  transferCode: string;
  status: string;
}

// ---- Platform admin: Admin management (sub-phase E) --------------------------

export interface PlatformAdminListItem {
  id: string;
  email: string;
  phone: string;
  name?: string;
  isActive: boolean;
  createdAt: string;
}
