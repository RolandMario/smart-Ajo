/**
 * Types mirroring ajo-server's response shapes for the full mobile API.
 * Hand-written (not generated) since the backend is a separate repo.
 */

// ---- Auth types ----

export type Role = "platform_admin" | "user";

export interface AuthUser {
  id: string;
  phone: string;
  email?: string;
  name?: string;
  role: Role;
  isPhoneVerified: boolean;
  isEmailVerified: boolean;
}

export interface OtpRequestResponse {
  message: string;
}

export interface OtpVerifyResponse {
  accessToken: string;
  user: AuthUser;
}

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
}

// ---- Group types ----

export type ContributionFrequency = "daily" | "weekly" | "monthly";
export type RotationMethod = "manual" | "random";
export type GroupStatus = "open_for_invites" | "order_locked" | "active" | "completed" | "terminated";
export type InviteStatus = "pending" | "accepted" | "declined";
export type PayoutStatus = "pending" | "collected";

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

export interface GroupMemberUser {
  _id: string;
  name?: string;
  phone: string;
  email?: string;
}

export interface GroupMember {
  _id: string;
  group: string;
  user: GroupMemberUser;
  isGroupAdmin: boolean;
  inviteStatus: InviteStatus;
  position: number | null;
  payoutStatus: PayoutStatus;
  invitedAt?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyGroupListItem {
  group: Group;
  membership: {
    id: string;
    isGroupAdmin: boolean;
    position: number | null;
    payoutStatus: PayoutStatus;
  };
}

export interface GroupDetail {
  group: Group;
  members: GroupMember[];
}

export interface CreateGroupPayload {
  name: string;
  contributionAmount: number;
  frequency?: ContributionFrequency;
  totalSlots: number;
  rotationMethod: RotationMethod;
}

export interface CreateGroupResponse {
  group: Group;
  membership: GroupMember;
}

export interface InvitePayload {
  phone: string;
}

export type InviteResponseAction = "accept" | "decline";

export interface RespondToInvitePayload {
  action: InviteResponseAction;
}

export interface MyInviteListItem {
  inviteId: string;
  invitedAt: string;
  group: Group & { createdBy: { _id: string; name?: string; phone: string } };
}

export interface LockRotationPayload {
  order?: string[];
}

export interface SetAutoCollectPayload {
  enabled: boolean;
}

// ---- Cycle types ----

export type CycleStatus = "open" | "completed";
export type ContributionStatus = "pending" | "paid" | "defaulted";

export interface CycleRecipientMember {
  _id: string;
  position: number | null;
  user: GroupMemberUser;
}

export interface Cycle {
  _id: string;
  group: string;
  cycleNumber: number;
  recipientMember: CycleRecipientMember;
  contributionAmount: number;
  totalSlots: number;
  dueDate: string;
  status: CycleStatus;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CycleWithPaidCount extends Cycle {
  paidCount: number;
}

export interface PopulatedContribution {
  _id: string;
  group: string;
  cycle: string;
  member: string;
  user: GroupMemberUser;
  amount: number;
  status: ContributionStatus;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CurrentCycleResponse {
  cycle: Cycle;
  contributions: PopulatedContribution[];
  isAdmin: boolean;
}

// ---- Wallet types ----

export type WalletTransactionType = "funding" | "contribution_debit" | "contribution_refund";
export type WalletTransactionStatus = "pending" | "success" | "failed";

export interface WalletTransaction {
  _id: string;
  wallet: string;
  user: string;
  type: WalletTransactionType;
  status: WalletTransactionStatus;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference: string;
  group?: string;
  cycle?: string;
  contribution?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface WalletSummary {
  balance: number;
  currency: string;
  recentTransactions: WalletTransaction[];
}

export interface FundWalletResponse {
  authorizationUrl: string;
  reference: string;
}

export interface BankListEntry {
  name: string;
  code: string;
  currency: string;
  type: string;
}

export interface BankAccount {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  paystackRecipientCode: string;
}

export interface SetBankAccountPayload {
  accountNumber: string;
  bankCode: string;
  bankName: string;
}

// ---- Notification types ----

export type NotificationType =
  | "group_invite_received"
  | "group_invite_accepted"
  | "group_invite_declined"
  | "group_activated"
  | "rotation_order_locked"
  | "contribution_due_reminder"
  | "contribution_due_urgent"
  | "contribution_debited"
  | "contribution_failed_insufficient"
  | "contribution_defaulted"
  | "group_continued"
  | "group_terminated"
  | "payout_initiated"
  | "payout_success"
  | "payout_failed"
  | "payout_reversed"
  | "wallet_funded";

export interface AppNotification {
  _id: string;
  user: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  channel: string;
  status: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  unreadCount: number;
}

export interface MarkReadPayload {
  notificationIds: string[];
}

export interface RegisterDeviceTokenPayload {
  token: string;
  platform?: "ios" | "android";
}

// ---- Generic API error ----

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
}

// ---- Collection response helpers ----

export interface PaginationParams {
  limit?: number;
  skip?: number;
}
// ---- Bill payment types ----

export type BillServiceType = "airtime" | "data" | "cable" | "electricity";
export type BillStatus = "pending" | "success" | "failed";

export interface BillTransaction {
  _id: string;
  user: string;
  type: BillServiceType;
  status: BillStatus;
  amount: number;
  reference: string;
  externalReference?: string;
  provider: string;
  recipient: string;
  metadata?: Record<string, unknown>;
  walletTransaction?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AirtimePayload {
  phone: string;
  amount: number;
  network: string;
}

export interface DataPayload {
  phone: string;
  dataPlanId: string;
  network: string;
}

export interface DataPlan {
  id: string;
  name: string;
  amount: number;
  network: string;
  size: string;
}

export interface CablePayload {
  serviceProvider: "dstv" | "gotv" | "startimes";
  smartCardNumber: string;
  amount: number;
  packageName?: string;
}

export interface ElectricityPayload {
  disco: string;
  meterNumber: string;
  meterType: "prepaid" | "postpaid";
  amount: number;
  phone: string;
}

export interface ValidateMeterPayload {
  disco: string;
  meterNumber: string;
  meterType: "prepaid" | "postpaid";
}

export interface ValidateSmartCardPayload {
  serviceProvider: "dstv" | "gotv" | "startimes";
  smartCardNumber: string;
}

export interface ValidationResult {
  valid: boolean;
  name?: string;
  address?: string;
  packageInfo?: string;
  outstanding?: number;
  message?: string;
}
