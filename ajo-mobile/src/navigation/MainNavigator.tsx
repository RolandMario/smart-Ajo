import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { MainTabParamList, GroupsStackParamList, WalletStackParamList, ProfileStackParamList, BillsStackParamList } from "./types";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GroupsListScreen } from "../screens/home/GroupsListScreen";
import { CreateGroupScreen } from "../screens/home/CreateGroupScreen";
import { GroupDetailScreen } from "../screens/home/GroupDetailScreen";
import { GroupMembersScreen } from "../screens/home/GroupMembersScreen";
import { InviteMemberScreen } from "../screens/home/InviteMemberScreen";
import { LockRotationScreen } from "../screens/home/LockRotationScreen";
import { ActivateGroupScreen } from "../screens/home/ActivateGroupScreen";
import { EditGroupScreen } from "../screens/home/EditGroupScreen";
import { CyclesListScreen } from "../screens/home/CyclesListScreen";
import { CycleDetailScreen } from "../screens/home/CycleDetailScreen";
import { CurrentCycleScreen } from "../screens/home/CurrentCycleScreen";
import { ContinueGroupScreen } from "../screens/home/ContinueGroupScreen";
import { WalletHomeScreen } from "../screens/home/WalletHomeScreen";
import { TransactionReceiptScreen } from "../screens/wallet/TransactionReceiptScreen";
import { FundWalletScreen } from "../screens/home/FundWalletScreen";
import { BankAccountScreen } from "../screens/home/BankAccountScreen";
import { CreateSavingsPlanScreen } from "../screens/savings/CreateSavingsPlanScreen";
import { SavingsPlansListScreen } from "../screens/savings/SavingsPlansListScreen";
import { SavingsPlanDetailScreen } from "../screens/savings/SavingsPlanDetailScreen";
import { NotificationsScreen } from "../screens/home/NotificationsScreen";
import { EditProfileScreen } from "../screens/home/EditProfileScreen";
import { ProfileScreen } from "../screens/home/ProfileScreen";
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
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const BillsStack = createNativeStackNavigator<BillsStackParamList>();

/** Height of the tab bar content (labels/icons), excluding the device's bottom
 * safe-area (home indicator / gesture bar / Android system nav bar). */
const TAB_BAR_HEIGHT = 49;

function GroupsStackNavigator() {
  return (
    <GroupsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
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
        name="InviteMember"
        component={InviteMemberScreen}
        options={{ title: "Invite" }}
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
        options={{ title: "Current Cycle" }}
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
 * Wallet stack so FundWallet and BankAccount are navigable from the
 * Wallet tab (they were previously only registered in ProfileStack,
 * causing "The action 'NAVIGATE' with payload ... was not handled"
 * errors).
 */
function WalletStackNavigator() {
  return (
    <WalletStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
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
        name="CreateSavingsPlan"
        component={CreateSavingsPlanScreen}
        options={{ title: "Create Savings" }}
      />
      <WalletStack.Screen
        name="SavingsPlans"
        component={SavingsPlansListScreen}
        options={{ title: "My Savings" }}
      />
      <WalletStack.Screen
        name="SavingsPlanDetail"
        component={SavingsPlanDetailScreen}
        options={{ title: "Savings Plan" }}
      />
      <WalletStack.Screen
        name="TransactionReceipt"
        component={TransactionReceiptScreen}
        options={{ title: "Receipt" }}
      />
    </WalletStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
      }}
    >
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: "Edit Profile" }}
      />
      <ProfileStack.Screen
        name="WalletHome"
        component={WalletHomeScreen}
        options={{
          title: "Wallet",
          headerShown: false,
        }}
      />
      <ProfileStack.Screen
        name="FundWallet"
        component={FundWalletScreen}
        options={{ title: "Fund Wallet" }}
      />
      <ProfileStack.Screen
        name="BankAccount"
        component={BankAccountScreen}
        options={{ title: "Bank Account" }}
      />
      <ProfileStack.Screen
        name="CreateSavingsPlan"
        component={CreateSavingsPlanScreen}
        options={{ title: "Create Savings" }}
      />
      <ProfileStack.Screen
        name="SavingsPlans"
        component={SavingsPlansListScreen}
        options={{ title: "My Savings" }}
      />
      <ProfileStack.Screen
        name="SavingsPlanDetail"
        component={SavingsPlanDetailScreen}
        options={{ title: "Savings Plan" }}
      />
      <ProfileStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: "Notifications" }}
      />
    </ProfileStack.Navigator>
  );
}

function BillsStackNavigator() {
  return (
    <BillsStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
      }}
    >
      <BillsStack.Screen name="BillServices" component={BillServicesScreen} options={{ title: "Pay Bills" }} />
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
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.ink },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          // Explicitly pad the tab bar above the device's bottom safe-area
          // (home indicator / gesture bar / Android system nav bar) and grow
          // its height to match, so it never hides underneath on a built app.
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkFaint,
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
      <Tab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={({ route }) => ({
          title: "Alerts",
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons name={focused ? "notifications" : "notifications-outline"} size={size} color={color} />
          ),
        })}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNavigator}
        options={({ route }) => ({
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
          ),
        })}
      />
    </Tab.Navigator>
  );
}
