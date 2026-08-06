import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { GroupsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ApiError } from "../../api/api-error";
import { inviteMember } from "../../api/groups";
import { toE164Nigeria } from "../../utils/phone";
import { colors, spacing, typography } from "../../theme";

type Props = NativeStackScreenProps<GroupsStackParamList, "InviteMember">;

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export function InviteMemberScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const [rawPhone, setRawPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleInvite() {
    const phone = toE164Nigeria(rawPhone);

    if (!E164_REGEX.test(phone)) {
      setError("Enter a valid Nigerian phone number, e.g. 0801 234 5678.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await inviteMember(groupId, phone);
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to send invite. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={styles.title}>Invite a Member</Text>
      <Text style={styles.subtitle}>
        Enter the phone number of the person you want to invite. They must have an Ajo account.
      </Text>

      {error && <ErrorBanner message={error} />}

      <TextField
        label="Phone number"
        placeholder="0801 234 5678"
        keyboardType="phone-pad"
        autoComplete="tel"
        textContentType="telephoneNumber"
        value={rawPhone}
        onChangeText={setRawPhone}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleInvite}
      />

      <Button title="Send Invite" onPress={handleInvite} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.inkSoft,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
});