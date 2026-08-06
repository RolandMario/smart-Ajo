import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Splash: undefined;
  PhoneEntry: undefined;
  Register: undefined;
  OtpVerification: { phone: string };
  ForgotPassword: undefined;
  ResetPassword: { phone: string };
};

export type GroupsStackParamList = {
  GroupsList: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string };
  GroupMembers: { groupId: string };
  InviteMember: { groupId: string };
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
  };
};

export type MainTabParamList = {
  GroupsTab: NavigatorScreenParams<GroupsStackParamList>;
  Wallet: NavigatorScreenParams<WalletStackParamList>;
  Bills: NavigatorScreenParams<BillsStackParamList>;
  Notifications: undefined;
  Profile: undefined;
};

export type WalletStackParamList = {
  WalletHome: undefined;
  FundWallet: undefined;
  BankAccount: undefined;
  SelectBank: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};

declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentional: this interface exists only to be extended via declaration merging
    interface RootParamList extends RootStackParamList {}
  }
}