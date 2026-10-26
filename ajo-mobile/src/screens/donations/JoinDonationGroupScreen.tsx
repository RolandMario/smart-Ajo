import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { DonationsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ApiError } from "../../api/api-error";
import { joinDonationGroup } from "../../api/donations";
import { colors, radii, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<
  DonationsStackParamList,
  "JoinDonationGroup"
>;

/**
 * Joins a pool by the Group ID its admin shared. The server normalises case
 * and stray dashes, and joining twice is a no-op — so this screen only has to
 * get the code to the API and forward to the pool.
 */
export function JoinDonationGroupScreen({ navigation }: Props) {
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter the Group ID to join a pool.");
      return;
    }

    setError(null);
    setJoining(true);
    try {
      const detail = await joinDonationGroup(trimmed);
      navigation.replace("DonationGroupDetail", {
        groupId: detail.group._id,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Could not join the pool. Please try again.");
      }
      setJoining(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <Text style={styles.title}>Join a Pool</Text>
        <Text style={styles.subtitle}>
          Enter the Group ID the pool admin shared with you. You will be able to
          donate immediately after joining.
        </Text>

        {error && <ErrorBanner message={error} />}

        <TextField
          label="Group ID"
          placeholder="e.g. 7K3QP2MA"
          value={code}
          onChangeText={(text) => {
            setCode(text);
            setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          autoFocus
          returnKeyType="go"
          onSubmitEditing={handleJoin}
        />

        <Button
          title="Join Pool"
          icon="enter-outline"
          onPress={handleJoin}
          loading={joining}
          disabled={!code.trim()}
        />

        <View style={styles.helper}>
          <Text style={styles.helperTitle}>Where do I find the Group ID?</Text>
          <Text style={styles.helperText}>
            Open the pool in the app — the admin sees it on the pool screen with
            a copy button, ready to send over WhatsApp or SMS.
          </Text>
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.forestLightInkSoft,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  helper: {
    backgroundColor: colors.forestLightCard,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  helperTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginBottom: spacing.xs,
  },
  helperText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    lineHeight: 20,
  },
});
