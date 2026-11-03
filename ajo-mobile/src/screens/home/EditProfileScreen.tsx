import React, { useState } from "react";
import { Screen } from "../../components/Screen";
import { SubpageHeader } from "../../components/SubpageHeader";
import { TextField } from "../../components/TextField";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { ApiError } from "../../api/api-error";
import { updateProfile } from "../../api/auth";
import { useAuth } from "../../auth/AuthContext";

export function EditProfileScreen({ navigation }: any) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);

    try {
      await updateProfile({ name: name || undefined, email: email || undefined });
      await refreshUser();
      navigation.goBack();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to update profile.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <SubpageHeader title="Edit Profile" onBack={() => navigation.goBack()} />

      {error && <ErrorBanner message={error} />}

      <TextField
        label="Full name"
        placeholder="Your name"
        value={name}
        onChangeText={setName}
        autoFocus
      />

      <TextField
        label="Email address"
        placeholder="your@email.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />

      <TextField
        label="Phone"
        value={user?.phone ?? ""}
        editable={false}
      />

      <Button title="Save Changes" onPress={handleSave} loading={loading} />
    </Screen>
  );
}
