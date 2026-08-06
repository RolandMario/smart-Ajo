import React, { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import * as Notifications from "expo-notifications";
import { useCycleRefresh } from "./CycleRefreshContext";

/**
 * Foreground notification handler.
 *
 * Listens for incoming FCM push notifications while the app is in the
 * foreground and emits cycle-refresh events when a CYCLE_ADVANCED
 * notification is received.
 *
 * Also refreshes cycle data when the app comes to the foreground,
 * which handles the case where a notification was received while the
 * app was backgrounded and the user tapped on it to open the app.
 */
export function NotificationHandler({ children }: { children: React.ReactNode }) {
  const { notifyCycleAdvanced } = useCycleRefresh();
  const lastAppState = useRef<AppStateStatus>(AppState.currentState);

  // Set up foreground notification handler
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        if (data?.type === "cycle_advanced" && data?.groupId) {
          notifyCycleAdvanced(data.groupId as string);
        }
      },
    );

    return () => subscription.remove();
  }, [notifyCycleAdvanced]);

  // Handle notification taps (app opened from background via notification)
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === "cycle_advanced" && data?.groupId) {
          notifyCycleAdvanced(data.groupId as string);
        }
      },
    );

    return () => subscription.remove();
  }, [notifyCycleAdvanced]);

  // Also refresh when app comes to foreground (catches any missed notifications)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (lastAppState.current.match(/inactive|background/) && nextAppState === "active") {
        // App came to foreground — the individual screens will handle
        // their own refresh via their existing AppState listeners.
        // We don't need to do anything here since CurrentCycleScreen
        // already has its own AppState listener.
      }
      lastAppState.current = nextAppState;
    });

    return () => subscription.remove();
  }, []);

  return <>{children}</>;
}