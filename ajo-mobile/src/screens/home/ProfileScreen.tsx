import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { useAuth } from "../../auth/AuthContext";
import { formatPhoneForDisplay } from "../../utils/phone";
import { colors, radii, spacing, typography } from "../../theme";

export function ProfileScreen({ navigation }: any) {
  const { user, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen>
      <ScrollView>
        <Text style={styles.heading}>Profile</Text>

        <View style={styles.card}>
          <Row label="Name" value={user?.name ?? "—"} />
          <Row label="Phone" value={user ? formatPhoneForDisplay(user.phone) : "—"} />
          <Row label="Email" value={user?.email ?? "—"} isLast />
        </View>

        <Text style={styles.sectionTitle}>Account</Text>

        <Pressable
          style={styles.menuRow}
          onPress={() => navigation.navigate("EditProfile")}
        >
          <Text style={styles.menuText}>Edit Profile</Text>
          <Text style={styles.menuArrow}>→</Text>
        </Pressable>

        <Pressable
          style={styles.menuRow}
          onPress={() => navigation.navigate("WalletHome")}
        >
          <Text style={styles.menuText}>Wallet</Text>
          <Text style={styles.menuArrow}>→</Text>
        </Pressable>

        <Pressable
          style={styles.menuRow}
          onPress={() => navigation.navigate("BankAccount")}
        >
          <Text style={styles.menuText}>Bank Account</Text>
          <Text style={styles.menuArrow}>→</Text>
        </Pressable>

        <Pressable
          style={styles.menuRow}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Text style={styles.menuText}>Notifications</Text>
          <Text style={styles.menuArrow}>→</Text>
        </Pressable>

        <Pressable
          style={[styles.menuRow, styles.menuRowLast]}
          onPress={() => handleSignOut}
        >
          <Text style={styles.menuText}>Invites</Text>
          <Text style={styles.menuArrow}>→</Text>
        </Pressable>

        <Button
          title="Sign out"
          variant="secondary"
          onPress={handleSignOut}
          loading={signingOut}
          style={styles.signOutButton}
        />
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value, isLast }: { label: string; value: string; isLast?: boolean }) {
  return (
    <View style={[styles.row, !isLast && styles.rowBorder]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLabel: {
    fontSize: typography.sizes.sm,
    color: colors.inkSoft,
  },
  rowValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.ink,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.ink,
    marginBottom: spacing.md,
  },
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderBottomWidth: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  menuRowLast: {
    borderBottomWidth: 1,
    borderBottomLeftRadius: radii.md,
    borderBottomRightRadius: radii.md,
    marginBottom: spacing.xl,
  },
  menuText: {
    fontSize: typography.sizes.base,
    color: colors.ink,
  },
  menuArrow: {
    fontSize: typography.sizes.base,
    color: colors.inkFaint,
  },
  signOutButton: {
    marginTop: spacing.md,
  },
});