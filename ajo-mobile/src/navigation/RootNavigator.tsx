import React from "react";
import {
  NavigationContainer,
  DefaultTheme,
  type Theme as NavTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuth } from "../auth/AuthContext";
import { AuthNavigator } from "./AuthNavigator";
import { MainNavigator } from "./MainNavigator";
import { LoadingScreen } from "../components/LoadingScreen";
import { colors } from "../theme";

const RootStack = createNativeStackNavigator();

const navigationTheme: NavTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.canvas,
    card: colors.surface,
    text: colors.ink,
    border: colors.line,
    primary: colors.primary,
  },
};

/**
 * Switches between the Auth stack and the Main (authenticated) tabs
 * based on AuthContext's status. This is the standard React Navigation
 * "conditional rendering" auth pattern — swapping which navigator is
 * mounted, rather than trying to push/pop/reset across stacks manually
 * from inside a screen. Screens never call navigation.navigate to cross
 * this boundary; they just call the relevant AuthContext action
 * (verifyOtp / signOut) and this component reacts to the resulting
 * status change.
 */
export function RootNavigator() {
  const { status } = useAuth();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {status === "signedIn" ? (
          <RootStack.Screen name="Main" component={MainNavigator} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
