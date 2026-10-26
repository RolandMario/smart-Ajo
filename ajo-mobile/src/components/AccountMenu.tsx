import React, { useCallback, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../navigation/types";
import { Avatar } from "./Avatar";
import { useAuth } from "../auth/AuthContext";
import { listNotifications } from "../api/notifications";
import { colors, radii, spacing, typography } from "../theme";
import { displayName } from "../utils/names";
import { formatPhoneForDisplay } from "../utils/phone";

/** Diameter of the avatar chip, sized to sit level with a screen's title. */
const AVATAR_SIZE = 44;

interface AccountMenuProps {
  style?: StyleProp<ViewStyle>;
}

/**
 * The account entry point that replaced the "Alerts" and "Profile" tabs:
 * the member's initial, pinned to the top-right corner of every tab root.
 * Tapping it drops a small card with the two destinations (Alerts — with the
 * live unread count — and Profile), picked up by the Root stack's `Account`
 * screen so they open full-screen over the tab bar.
 *
 * The unread dot is best-effort: it refreshes when the host screen gains
 * focus, and a failed lookup just leaves the badge off.
 */
export function AccountMenu({ style }: AccountMenuProps) {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const refreshUnread = useCallback(() => {
    // One row is enough — the response also carries `unreadCount`.
    void listNotifications(1, 0)
      .then((res) => setUnread(res.unreadCount ?? 0))
      .catch(() => {
        // Badge only — stay quiet if the inbox can't be read right now.
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshUnread();
    }, [refreshUnread]),
  );

  function openMenu() {
    setOpen(true);
    refreshUnread();
  }

  function goTo(screen: "ProfileMain" | "Notifications") {
    setOpen(false);
    if (screen === "Notifications") {
      // `initial: false` keeps Profile out of the back stack when Alerts is
      // opened straight from a tab — back returns to that tab, not Profile.
      navigation.navigate("Account", { screen, initial: false });
      return;
    }
    navigation.navigate("Account", { screen });
  }

  const triggerLabel =
    unread > 0
      ? `Account menu, ${unread} unread ${unread === 1 ? "alert" : "alerts"}`
      : "Account menu";

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={triggerLabel}
        accessibilityHint="Opens alerts and profile"
        hitSlop={8}
        onPress={openMenu}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed, style]}
      >
        <Avatar name={user?.name} tone="forest" size={AVATAR_SIZE} />
        {unread > 0 ? <View style={styles.unreadDot} /> : null}
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close account menu"
          style={styles.backdrop}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={[styles.menu, { top: insets.top + spacing.md }]}
            onPress={() => {
              // Swallow taps inside the card so they don't dismiss it.
            }}
          >
            <View style={styles.menuIdentity}>
              <Avatar name={user?.name} tone="green" size={38} />
              <View style={styles.menuIdentityText}>
                <Text style={styles.menuName} numberOfLines={1}>
                  {user?.name ? displayName(user.name) : "Ajo member"}
                </Text>
                <Text style={styles.menuPhone} numberOfLines={1}>
                  {user ? formatPhoneForDisplay(user.phone) : ""}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={unread > 0 ? `Alerts, ${unread} unread` : "Alerts"}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => goTo("Notifications")}
            >
              <Ionicons
                name="notifications-outline"
                size={20}
                color={colors.forestAction}
              />
              <Text style={styles.rowLabel}>Alerts</Text>
              {unread > 0 ? (
                <View style={styles.countPill}>
                  <Text style={styles.countText}>
                    {unread > 99 ? "99+" : unread}
                  </Text>
                </View>
              ) : null}
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.forestLightInkFaint}
              />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Profile"
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => goTo("ProfileMain")}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={colors.forestAction}
              />

              <Text style={styles.rowLabel}>Profile</Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.forestLightInkFaint}
              />
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  pressed: {
    opacity: 0.7,
  },
  unreadDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: radii.full,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.forestLightCanvas,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(10,26,20,0.28)",
  },
  menu: {
    position: "absolute",
    right: spacing.lg,
    width: 248,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    paddingVertical: spacing.sm,
    shadowColor: colors.black,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  menuIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  menuIdentityText: {
    flex: 1,
    minWidth: 0,
  },
  menuName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  menuPhone: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.forestLightLine,
    marginVertical: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  rowPressed: {
    backgroundColor: colors.forestLightField,
  },
  rowLabel: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.forestLightInk,
  },
  countPill: {
    minWidth: 22,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.full,
    backgroundColor: colors.dangerSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.danger,
  },
});
