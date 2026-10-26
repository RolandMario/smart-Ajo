import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { MainTabParamList, GroupsStackParamList, WalletStackParamList, BillsStackParamList, SavingsStackParamList, DonationsStackParamList } from "./types";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GroupsListScreen } from "../screens/home/GroupsListScreen";
import { CreateGroupScreen } from "../screens/home/CreateGroupScreen";
import { GroupDetailScreen } from "../screens/home/GroupDetailScreen";
import { GroupMembersScreen } from "../screens/home/GroupMembersScreen";
import { JoinGroupScreen } from "../screens/home/JoinGroupScreen";
import { LockRotationScreen } from "../screens/home/LockRotationScreen";
import { ActivateGroupScreen } from "../screens/home/ActivateGroupScreen";
import { EditGroupScreen } from "../screens/home/EditGroupScreen";
import { CyclesListScreen } from "../screens/home/CyclesListScreen";
import { CycleDetailScreen } from "../screens/home/CycleDetailScreen";
import { CurrentCycleScreen } from "../screens/home/CurrentCycleScreen";
import { ContinueGroupScreen } from "../screens/home/ContinueGroupScreen";
import { WalletHomeScreen } from "../screens/home/WalletHomeScreen";
import { TransactionsScreen } from "../screens/wallet/TransactionsScreen";
import { TransactionReceiptScreen } from "../screens/wallet/TransactionReceiptScreen";
import { FundWalletScreen } from "../screens/home/FundWalletScreen";
import { BankAccountScreen } from "../screens/home/BankAccountScreen";
import { CreateSavingsPlanScreen } from "../screens/savings/CreateSavingsPlanScreen";
import { SavingsPlansListScreen } from "../screens/savings/SavingsPlansListScreen";
import { SavingsPlanDetailScreen } from "../screens/savings/SavingsPlanDetailScreen";
import { DonationsListScreen } from "../screens/donations/DonationsListScreen";
import { CreateDonationGroupScreen } from "../screens/donations/CreateDonationGroupScreen";
import { JoinDonationGroupScreen } from "../screens/donations/JoinDonationGroupScreen";
import { DonationGroupDetailScreen } from "../screens/donations/DonationGroupDetailScreen";
import { DonationGroupDonationsScreen } from "../screens/donations/DonationGroupDonationsScreen";
import { DonationPayoutScreen } from "../screens/donations/DonationPayoutScreen";
import { BillServicesScreen } from "../screens/bills/BillServicesScreen";
import { AirtimePurchaseScreen } from "../screens/bills/AirtimePurchaseScreen";
import { DataPurchaseScreen } from "../screens/bills/DataPurchaseScreen";
import { CableSubscriptionScreen } from "../screens/bills/CableSubscriptionScreen";
import { ElectricityPaymentScreen } from "../screens/bills/ElectricityPaymentScreen";
import { BillConfirmationScreen } from "../screens/bills/BillConfirmationScreen";
import { BillSuccessScreen } from "../screens/bills/BillSuccessScreen";
import { colors } from "../theme";

const Tab = createBottomTabNavigator<MainTabParamList>();
const GroupsStack = createNativeStackNavigator<GroupsStackParamList>();
const WalletStack = createNativeStackNavigator<WalletStackParamList>();
const BillsStack = createNativeStackNavigator<BillsStackParamList>();
const SavingsStack = createNativeStackNavigator<SavingsStackParamList>();
const DonationsStack = createNativeStackNavigator<DonationsStackParamList>();

/** Height of the tab bar content (labels/icons), excluding the device's bottom
 * safe-area (home indicator / gesture bar / Android system nav bar). */
const TAB_BAR_HEIGHT = 49;

function GroupsStackNavigator() {
  return (
    <GroupsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.forestLightInk,
      }}
    >
      <GroupsStack.Screen
        name="GroupsList"
        component={GroupsListScreen}
        options={{ headerShown: false }}
      />
      <GroupsStack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: "Create Group" }}
      />
      <GroupsStack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ title: "Group" }}
      />
      <GroupsStack.Screen
        name="GroupMembers"
        component={GroupMembersScreen}
        options={{ title: "Members" }}
      />
      <GroupsStack.Screen
        name="JoinGroup"
        component={JoinGroupScreen}
        options={{ title: "Join a Group" }}
      />
      <GroupsStack.Screen
        name="LockRotation"
        component={LockRotationScreen}
        options={{ title: "Payout Order" }}
      />
      <GroupsStack.Screen
        name="ActivateGroup"
        component={ActivateGroupScreen}
        options={{ title: "Activate" }}
      />
      <GroupsStack.Screen
        name="EditGroup"
        component={EditGroupScreen}
        options={{ title: "Edit Group" }}
      />
      <GroupsStack.Screen
        name="CyclesList"
        component={CyclesListScreen}
        options={{ title: "Cycles" }}
      />
      <GroupsStack.Screen
        name="CycleDetail"
        component={CycleDetailScreen}
        options={{ title: "Cycle" }}
      />
      <GroupsStack.Screen
        name="CurrentCycle"
        component={CurrentCycleScreen}
        options={{ headerShown: false, title: "Current Cycle" }}
      />
      <GroupsStack.Screen
        name="ContinueGroup"
        component={ContinueGroupScreen}
        options={{ title: "Continue Group" }}
      />
    </GroupsStack.Navigator>
  );
}

/**
 * Wallet stack — home, fund wallet, bank account, transactions. Reachable
 * from the Wallet tab and from the profile's "Wallet" / "Bank account"
 * shortcuts (which hop back to this tab).
 */
function WalletStackNavigator() {
  return (
    <WalletStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.forestLightInk,
      }}
    >
      <WalletStack.Screen
        name="WalletHome"
        component={WalletHomeScreen}
        options={{ headerShown: false }}
      />
      <WalletStack.Screen
        name="FundWallet"
        component={FundWalletScreen}
        options={{ title: "Fund Wallet" }}
      />
      <WalletStack.Screen
        name="BankAccount"
        component={BankAccountScreen}
        options={{ title: "Bank Account" }}
      />
      <WalletStack.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={{ title: "Transactions" }}
      />
      <WalletStack.Screen
        name="TransactionReceipt"
        component={TransactionReceiptScreen}
        options={{ title: "Receipt" }}
      />
    </WalletStack.Navigator>
  );
}

/**
 * Personal savings tab. Plans are funded by the member from their wallet —
 * one interval at a time from the detail screen — so the whole flow
 * (list -> create -> pay/withdraw) lives inside this stack.
 */
function SavingsStackNavigator() {
  return (
    <SavingsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.forestLightInk,
      }}
    >
      <SavingsStack.Screen
        name="SavingsList"
        component={SavingsPlansListScreen}
        options={{ headerShown: false }}
      />
      <SavingsStack.Screen
        name="CreateSavingsPlan"
        component={CreateSavingsPlanScreen}
        options={{ title: "Create Savings" }}
      />
      <SavingsStack.Screen
        name="SavingsPlanDetail"
        component={SavingsPlanDetailScreen}
        options={{ title: "Savings Plan" }}
      />
    </SavingsStack.Navigator>
  );
}

/**
 * Pool collections tab. Create a pool, join one by Group ID, donate from the
 * wallet, browse the donor history, and (as pool admin) pay the escrow out.
 */
function DonationsStackNavigator() {
  return (
    <DonationsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.forestLightInk,
      }}
    >
      <DonationsStack.Screen
        name="DonationsList"
        component={DonationsListScreen}
        options={{ headerShown: false }}
      />
      <DonationsStack.Screen
        name="CreateDonationGroup"
        component={CreateDonationGroupScreen}
        options={{ title: "Create Pool" }}
      />
      <DonationsStack.Screen
        name="JoinDonationGroup"
        component={JoinDonationGroupScreen}
        options={{ title: "Join Pool" }}
      />
      <DonationsStack.Screen
        name="DonationGroupDetail"
        component={DonationGroupDetailScreen}
        options={{ title: "Pool" }}
      />
      <DonationsStack.Screen
        name="DonationGroupDonations"
        component={DonationGroupDonationsScreen}
        options={{ title: "Donations" }}
      />
      <DonationsStack.Screen
        name="DonationPayout"
        component={DonationPayoutScreen}
        options={{ title: "Payouts" }}
      />
    </DonationsStack.Navigator>
  );
}

function BillsStackNavigator() {
  return (
    <BillsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.forestLightInk,
      }}
    >
      {/* BillServices draws its own title row (with the account avatar), so it
          hides the native header — otherwise "Pay Bills" would appear twice. */}
      <BillsStack.Screen name="BillServices" component={BillServicesScreen} options={{ headerShown: false }} />
      <BillsStack.Screen name="AirtimePurchase" component={AirtimePurchaseScreen} options={{ title: "Buy Airtime" }} />
      <BillsStack.Screen name="DataPurchase" component={DataPurchaseScreen} options={{ title: "Buy Data" }} />
      <BillsStack.Screen name="CableSubscription" component={CableSubscriptionScreen} options={{ title: "Cable TV" }} />
      <BillsStack.Screen name="ElectricityPayment" component={ElectricityPaymentScreen} options={{ title: "Electricity" }} />
      <BillsStack.Screen name="BillConfirmation" component={BillConfirmationScreen} options={{ title: "Confirm" }} />
      <BillsStack.Screen name="BillSuccess" component={BillSuccessScreen} options={{ headerShown: false }} />
    </BillsStack.Navigator>
  );
}

export function MainNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTitleStyle: { color: colors.forestLightInk },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.forestLightLine,
          // Explicitly pad the tab bar above the device's bottom safe-area
          // (home indicator / gesture bar / Android system nav bar) and grow
          // its height to match, so it never hides underneath on a built app.
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
        // The reference home-screen design highlights its active tab in the
        // forest action green.
        tabBarActiveTintColor: colors.forestAction,
        tabBarInactiveTintColor: colors.forestLightInkFaint,
      }}
    >
      <Tab.Screen
        name="Wallet"
        component={WalletStackNavigator}
        options={({ route }) => ({
          title: "Wallet",
          headerShown: false,
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons name={focused ? "wallet" : "wallet-outline"} size={size} color={color} />
          ),
        })}
      />
      <Tab.Screen
        name="SavingsTab"
        component={SavingsStackNavigator}
        options={({ route }) => ({
          title: "Savings",
          headerShown: false,
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons name={focused ? "cash" : "cash-outline"} size={size} color={color} />
          ),
        })}
      />
      <Tab.Screen
        name="GroupsTab"
        component={GroupsStackNavigator}
        options={({ route }) => ({
          title: "My Groups",
          headerShown: false,
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={size} color={color} />
          ),
        })}
      />
      <Tab.Screen
        name="DonationsTab"
        component={DonationsStackNavigator}
        options={() => ({
          title: "Pools",
          headerShown: false,
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons name={focused ? "gift" : "gift-outline"} size={size} color={color} />
          ),
        })}
      />
      <Tab.Screen
        name="Bills"
        component={BillsStackNavigator}
        options={({ route }) => ({
          title: "Bills",
          headerShown: false,
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons name={focused ? "receipt" : "receipt-outline"} size={size} color={color} />
          ),
        })}
      />
    </Tab.Navigator>
  );
}
