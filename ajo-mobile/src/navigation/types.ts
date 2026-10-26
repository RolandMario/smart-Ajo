import type { NavigatorScreenParams } from "@react-navigation/native";
import type { WalletTransaction } from "../types/api";

export type AuthStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  PhoneEntry: undefined;
  Register: undefined;
  /**
   * `fullName` is set only by the register flow — /auth/register takes no
   * name, so it's carried here and written to the profile once a token
   * exists (see OtpVerificationScreen). Undefined on the sign-in path.
   */
  OtpVerification: { phone: string; fullName?: string };
  ForgotPassword: undefined;
  ResetPassword: { phone: string };
};

export type GroupsStackParamList = {
  GroupsList: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string };
  GroupMembers: { groupId: string; joinCode?: string };
  JoinGroup: undefined;
  LockRotation: { groupId: string };
  ActivateGroup: { groupId: string };
  EditGroup: { groupId: string };
  CyclesList: { groupId: string };
  CycleDetail: { groupId: string; cycleId: string };
  CurrentCycle: { groupId: string };
  ContinueGroup: { groupId: string };
};

export type BillsStackParamList = {
  BillServices: undefined;
  AirtimePurchase: undefined;
  DataPurchase: undefined;
  CableSubscription: undefined;
  ElectricityPayment: undefined;
  BillConfirmation: {
    serviceType: "airtime" | "data" | "cable" | "electricity";
    provider: string;
    recipient: string;
    amount: number;
    customerName?: string;
    metadata?: Record<string, unknown>;
  };
  BillSuccess: {
    serviceType: "airtime" | "data" | "cable" | "electricity";
    reference: string;
    amount: number;
    recipient: string;
    provider: string;
    externalReference?: string;
    createdAt?: string;
  };
};

/**
 * The tab bar carries only the five money surfaces. Profile and Alerts used
 * to sit here too; they now open from the avatar chip in the top-right corner
 * of every tab root (see `components/AccountMenu.tsx` → `AccountNavigator`).
 */
export type MainTabParamList = {
  Wallet: NavigatorScreenParams<WalletStackParamList>;
  SavingsTab: NavigatorScreenParams<SavingsStackParamList>;
  GroupsTab: NavigatorScreenParams<GroupsStackParamList>;
  DonationsTab: NavigatorScreenParams<DonationsStackParamList>;
  Bills: NavigatorScreenParams<BillsStackParamList>;
};

/**
 * Personal savings live on their own tab (they used to be buried inside the
 * Wallet/Profile stacks), so a plan can be funded straight from the tab:
 * list -> create -> detail (where each interval is paid from the wallet).
 */
export type SavingsStackParamList = {
  SavingsList: undefined;
  CreateSavingsPlan: undefined;
  SavingsPlanDetail: { planId: string };
};

/**
 * Pool collections ("donation pools"). A member creates a pool, shares its
 * Group ID, and everyone donates from their wallet into the pool's escrow;
 * the pool admin pays the escrow out to a bank account.
 */
export type DonationsStackParamList = {
  DonationsList: undefined;
  CreateDonationGroup: undefined;
  JoinDonationGroup: undefined;
  DonationGroupDetail: { groupId: string };
  DonationGroupDonations: { groupId: string; groupName?: string };
  DonationPayout: { groupId: string; groupName?: string };
};

export type WalletStackParamList = {
  WalletHome: undefined;
  FundWallet: undefined;
  BankAccount: undefined;
  SelectBank: undefined;
  Transactions: undefined;
  TransactionReceipt: { transaction: WalletTransaction };
};

/**
 * Profile + Alerts. Mounted once in the Root stack (a sibling of the tab
 * navigator) so both open full-screen *above* the tab bar, and reached from
 * the avatar chip on every tab root.
 *
 * Wallet screens are deliberately absent: the "Wallet" / "Bank account"
 * shortcuts in Profile hop back to the Wallet tab (`Main` → `Wallet`) instead
 * of mounting a second copy of that stack.
 */
export type AccountStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  Notifications: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
  Account: NavigatorScreenParams<AccountStackParamList>;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional: this interface exists only to be extended via declaration merging
    interface RootParamList extends RootStackParamList {}
  }
}