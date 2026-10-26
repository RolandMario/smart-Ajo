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
  /** Unique shareable "Group ID" used to search for & join this group. */
  joinCode: string;
  createdBy: string;
  contributionAmount: number;
  frequency: ContributionFrequency;
  totalSlots: number;
  rotationMethod: RotationMethod;
  status: GroupStatus;
  orderLockedAt?: string;
  startDate?: string;
  currentCycleNumber?: number | null;
  currentRound: number;
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

export interface GroupSearchResult {
  group: Group;
  memberCount: number;
  isMember: boolean;
  isAdmin: boolean;
  isFull: boolean;
  joinable: boolean;
}

export interface JoinGroupResponse {
  group: Group;
  membership: GroupMember;
}

export interface LockRotationPayload {
  order?: string[];
}

// ---- Cycle types ----

export type CycleStatus = "open" | "completed";
/**
 * Mirrors ContributionStatus in ajo-server. `awaiting_confirmation` means
 * the member reported a bank transfer into the group's escrow account and
 * the group admin still has to verify it.
 */
export type ContributionStatus =
  | "pending"
  | "awaiting_confirmation"
  | "paid"
  | "defaulted";

export type ContributionPaymentMethod = "wallet" | "bank_transfer";

export interface CycleRecipientMember {
  _id: string;
  position: number | null;
  user: GroupMemberUser;
}

export interface Cycle {
  _id: string;
  group: string;
  cycleNumber: number;
  /** Round of the group this cycle belongs to; cycles restart at 1 each round. */
  round: number;
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
  /** Platform fee charged on top of `amount` (wallet pay) or up-front. */
  serviceFee?: number;
  status: ContributionStatus;
  paymentMethod?: ContributionPaymentMethod;
  /**
   * What the member puts on a bank transfer narration (e.g. `AJO-3F9K2A-2`)
   * so the escrow deposit can be matched to this contribution.
   */
  paymentReference?: string;
  paymentNotifiedAt?: string;
  claimedTransferReference?: string;
  confirmedAt?: string;
  lastRejectedAt?: string;
  lastRejectionReason?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * The group's escrow account — a Paystack Dedicated Virtual Account that
 * members transfer their contribution into when paying by bank transfer.
 * `null` until it has been provisioned.
 */
export interface EscrowAccount {
  bankName: string;
  accountName: string;
  accountNumber: string;
  provider: string;
  currency: string;
  active: boolean;
}

export interface CurrentCycleResponse {
  cycle: Cycle;
  contributions: PopulatedContribution[];
  escrowAccount: EscrowAccount | null;
  isAdmin: boolean;
  /**
   * Advisory: `false` when the cycle's recipient has not registered a payout
   * bank account yet, so the admin screen can warn before "Initiate payout"
   * fails. Optional because older server builds don't send it.
   */
  recipientPayoutReady?: boolean;
}

/** Mirrors TransferStatus in ajo-server's wallet.enum.ts. */
export type GroupPayoutStatus = "pending" | "success" | "failed" | "reversed";

/** The Payout document returned by POST /groups/:id/cycles/:cycleId/payout. */
export interface GroupPayout {
  _id: string;
  group: string;
  cycle: string;
  recipientMember: string;
  recipientUser: string;
  initiatedBy: string;
  amount: number;
  status: GroupPayoutStatus;
  paystackTransferCode?: string;
  paystackReference: string;
  failureReason?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ---- Wallet types ----

/** Mirrors WalletTransactionType in ajo-server's wallet.enum.ts. */
export type WalletTransactionType =
  | "funding"
  | "contribution_debit"
  | "contribution_refund"
  | "bill_payment"
  | "service_fee_debit"
  | "service_fee_credit"
  | "bill_commission_credit"
  | "admin_credit"
  | "admin_withdrawal"
  | "savings_debit";
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
  /** The member's Paystack Dedicated Virtual Account, when active. */
  dedicatedAccount?: DedicatedAccount | null;
}

/** Paginated member wallet ledger from GET /wallet/transactions. */
export interface PaginatedWalletTransactions {
  transactions: WalletTransaction[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

/** A Paystack Dedicated Virtual Account used to fund the wallet by bank transfer. */
export interface DedicatedAccount {
  paystackCustomerCode?: string;
  paystackAccountId?: string;
  accountNumber: string;
  accountName: string;
  bankName: string;
  provider: string;
  currency: string;
  active: boolean;
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
  | "wallet_funded"
  | "saving_created"
  | "saving_debited"
  | "saving_insufficient"
  | "saving_completed"
  | "saving_withdrawn"
  | "donation_received"
  | "donation_received_admin"
  | "donation_member_joined"
  | "donation_payout_success"
  | "donation_payout_failed"
  | "donation_payout_reversed"
  | "donation_pool_terminated";

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
  /** Total inbox rows for the member — drives the "Page 1 of N" pager. */
  total: number;
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

/**
 * Payload of GET /bills/services — the service categories the admin has
 * enabled for the member app (each backed by an active provider).
 */
export type BillServicesResponse = BillServiceType[];

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

/** A single purchasable data plan returned by GET /bills/data-plans. */
export interface DataPlan {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice?: boolean;
}

export interface CablePayload {
  serviceProvider: "dstv" | "gotv" | "startimes";
  smartCardNumber: string;
  amount: number;
  packageName?: string;
  variationCode?: string;
  /** Verified subscriber name, shown on the receipt. */
  customerName?: string;
}

export interface ElectricityPayload {
  disco: string;
  meterNumber: string;
  meterType: "prepaid" | "postpaid";
  amount: number;
  phone: string;
  /** Verified customer name, shown on the receipt. */
  customerName?: string;
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

// ---- Individual savings plan types ----

export type SavingPlanStatus = "active" | "completed" | "withdrawn" | "deleted";
export type SavingTransactionType = "saving_debit" | "saving_withdrawal" | "saving_refund";
export type SavingDurationUnit = "days" | "months" | "years";

export interface SavingPlan {
  _id: string;
  user: string;
  name: string;
  amount: number;
  frequency: ContributionFrequency;
  durationUnit: SavingDurationUnit;
  durationValue: number;
  /** Legacy: present only on plans created before durationUnit/durationValue existed (3 | 6 | 12). */
  durationMonths?: number;
  intervalCount: number;
  cycleNumber: number;
  collectedCount: number;
  savingsBalance: number;
  lifetimeSaved: number;
  status: SavingPlanStatus;
  nextDueAt: string;
  startAt: string;
  endAt?: string;
  withdrawnAt?: string;
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavingTransaction {
  _id: string;
  plan: string;
  user: string;
  type: SavingTransactionType;
  amount: number;
  reference: string;
  cycleNumber: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SavingPlanDetail {
  plan: SavingPlan;
  /** One page of the activity ledger, newest first. */
  transactions: SavingTransaction[];
  /** 1-based page the server resolved for `transactions`. */
  page: number;
  /** Rows per page (10 by default). */
  limit: number;
  /** Total number of ledger rows — drives the "Page 1 of N" pager. */
  total: number;
}

export interface CreateSavingPlanPayload {
  name: string;
  amount: number;
  frequency: ContributionFrequency;
  durationUnit: SavingDurationUnit;
  durationValue: number;
}

// ---- Pool donation ("pool collection") types ----

export type DonationAmountType = "fixed" | "free_will";
export type DonationSchedule = "one_time" | "interval";
export type DonationFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type DonationGroupStatus = "active" | "closed" | "terminated";
export type DonationPayoutStatus = "pending" | "success" | "failed" | "reversed";

/** Bank account stored on a pool to override the admin's own account. */
export interface DonationPayoutAccount {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  paystackRecipientCode: string;
}

/**
 * A donation pool. List rows also carry `isAdmin`, `myTotalDonated` and the
 * caller's current-window state (`alreadyDonated`, `canDonate`), which the
 * server computes per request.
 */
export interface DonationGroup {
  _id: string;
  name: string;
  purpose: string;
  amountType: DonationAmountType;
  /** Fixed amount per donation — absent for free-will pools. */
  amount?: number;
  schedule: DonationSchedule;
  /** Cadence for interval pools — absent for one-time pools. */
  frequency?: DonationFrequency;
  /** Short, shareable Group ID members use to join. */
  joinCode: string;
  admin: string;
  status: DonationGroupStatus;
  escrowBalance: number;
  totalCollected: number;
  totalPaidOut: number;
  memberCount: number;
  donorCount: number;
  /** Admin-only: pool-level payout destination override. */
  payoutAccount?: DonationPayoutAccount;
  lastDonationAt?: string;
  lastPayoutAt?: string;
  /** Set when the members voted to terminate the pool. */
  terminatedAt?: string;
  terminatedBy?: string;
  createdAt: string;
  updatedAt: string;

  // Enrichments present on GET /donations/groups rows
  isAdmin?: boolean;
  role?: "admin" | "member";
  myTotalDonated?: number;
  myDonationCount?: number;
  joinedAt?: string;
  period?: string;
  alreadyDonated?: boolean;
  canDonate?: boolean;
  nextDonationAt?: string | null;
}

/** Dashboard totals above the pool list. */
export interface DonationStats {
  poolCount: number;
  totalDonated: number;
  totalRaised: number;
  totalPaidOut: number;
  activePoolCount: number;
}

export interface DonationGroupsResponse {
  groups: DonationGroup[];
  stats: DonationStats;
}

/** A single donation row, enriched with the donor's display name. */
export interface Donation {
  _id: string;
  group: string;
  user: string;
  amount: number;
  /** Period bucket: `2026-10-25`, `2026-W43`, `2026-10`, `2026`, or `once`. */
  period: string;
  reference: string;
  donorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface DonationMemberSummary {
  joinedAt: string;
  totalDonated: number;
  donationCount: number;
  lastDonatedAt?: string;
}

/** Where a payout will be sent — `pool` override or the admin's own account. */
export interface DonationPayoutDestination {
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  source: "pool" | "admin";
}

/**
 * Where the pool stands on being terminated by member vote. Computed by the
 * server on every pool detail read so the switch and the terminate button
 * always agree with the votes and the money on record.
 *
 * Only members who have made 100% of their payment towards the pool are
 * eligible to vote; `requiredVotes` is 2/3 of them, rounded up.
 *
 * Two gates must both be open before the pool may be terminated: the 2/3 yes
 * vote (`votesMet`) and everything donated already paid out (`fundsUtilized`).
 * `canTerminate` is the AND of the two; only the pool admin may press it.
 */
export interface DonationTerminationStanding {
  /** The caller's own vote — drives the red/green switch. */
  myVote: boolean;
  /** True when the caller has paid 100% of their contribution. */
  eligible: boolean;
  /** Members who have paid 100% of their contribution. */
  eligibleCount: number;
  /** Yes votes cast by eligible members. */
  votes: number;
  /** 2/3 of `eligibleCount`, rounded up (0 when nobody is eligible). */
  requiredVotes: number;
  /** True once 2/3 of the eligible members voted yes. */
  votesMet: boolean;
  /** Lifetime donations received by the pool. */
  totalCollected: number;
  /** Lifetime amount paid out of the pool. */
  totalPaidOut: number;
  /** True when every naira donated has been paid out (escrow is empty). */
  fundsUtilized: boolean;
  /** True once BOTH `votesMet` and `fundsUtilized` hold (admin presses it). */
  canTerminate: boolean;
  terminated: boolean;
  /** Share of the eligible members who voted yes, 0-100. */
  percentVoted: number;
}

export interface DonationGroupDetail {
  group: DonationGroup;
  membership: DonationMemberSummary;
  isAdmin: boolean;
  role: "admin" | "member";
  /** "today" | "this week" | "this month" | "this year" | "one-time". */
  donationWindowLabel: string;
  period: string;
  alreadyDonated: boolean;
  lastDonationAmount?: number;
  nextDonationAt?: string | null;
  canDonate: boolean;
  reason?: string;
  termination: DonationTerminationStanding;
  recentDonations: Donation[];
  payoutDestination: DonationPayoutDestination | null;
}

/** POST /donations/groups/:id/terminate — the pool has been deleted. */
export interface DonationPoolTermination {
  groupId: string;
  status: "terminated";
}

/** GET /donations/groups/:id/donations */
export interface DonationListResponse {
  donations: Donation[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalCollected: number;
}

export interface DonationPayout {
  _id: string;
  group: string;
  initiatedBy: string;
  amount: number;
  status: DonationPayoutStatus;
  paystackReference: string;
  paystackTransferCode?: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  failureReason?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** GET /donations/groups/:id/payouts */
export interface DonationPayoutListResponse {
  payouts: DonationPayout[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  escrowBalance: number;
  totalPaidOut: number;
  totalCollected: number;
  destination: DonationPayoutDestination | null;
}

/** GET /donations/groups/:id/payout-account */
export interface DonationPayoutSetup {
  poolAccount: DonationPayoutAccount | null;
  adminAccount: BankAccount | null;
  destination: DonationPayoutDestination | null;
}

export interface CreateDonationGroupPayload {
  name: string;
  purpose: string;
  amountType: DonationAmountType;
  amount?: number;
  schedule: DonationSchedule;
  frequency?: DonationFrequency;
}

export interface DonatePayload {
  amount?: number;
}

export interface SetDonationPayoutAccountPayload {
  /** Clear the override and pay to the admin's own bank account. */
  useAdminAccount?: boolean;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
}
