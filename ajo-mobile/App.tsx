import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import { AuthProvider } from "./src/auth/AuthContext";
import { CycleRefreshProvider } from "./src/notifications/CycleRefreshContext";
import { NotificationHandler } from "./src/notifications/NotificationHandler";
import { RootNavigator } from "./src/navigation/RootNavigator";

// Show notifications as a heads-up banner even when the app is in the
// foreground, so users see cycle-advanced alerts without leaving the
// current screen.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export default function App() {
  // Request notification permissions on launch
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {
      // Permission denied — notifications will be silent
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CycleRefreshProvider>
            <NotificationHandler>
              <RootNavigator />
              <StatusBar style="dark" />
            </NotificationHandler>
          </CycleRefreshProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
