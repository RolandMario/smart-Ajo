import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { AccountStackParamList } from "./types";
import { ProfileScreen } from "../screens/home/ProfileScreen";
import { EditProfileScreen } from "../screens/home/EditProfileScreen";
import { NotificationsScreen } from "../screens/home/NotificationsScreen";
import { colors } from "../theme";

const AccountStack = createNativeStackNavigator<AccountStackParamList>();

/**
 * Profile + Alerts.
 *
 * These two screens used to be tabs. They're now mounted as a Root-stack
 * screen (a sibling of the tab navigator) so they slide in full-screen over
 * the tab bar, opened from the avatar chip in the top-right corner of every
 * tab root — see `components/AccountMenu.tsx`.
 */
export function AccountNavigator() {
  return (
    <AccountStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.forestLightInk,
        headerTitleStyle: { color: colors.forestLightInk },
        contentStyle: { backgroundColor: colors.forestLightCanvas },
      }}
    >
      <AccountStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <AccountStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: "Edit Profile" }}
      />
      {/* Alerts draws its own serif header (with the back chip), matching the
          other redesigned subpages. */}
      <AccountStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: false }}
      />
    </AccountStack.Navigator>
  );
}
