import React, { useEffect, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { colors, radii, spacing, typography } from "../theme";
import { e164ToLocalNigeria, formatLocalForDisplay, toE164Nigeria } from "../utils/phone";

/**
 * One selectable row: a single phone number of a device contact, already
 * normalized to the local Nigerian format the bill screens use (08012345678).
 */
interface ContactOption {
  key: string;
  name: string;
  initials: string;
  phoneLabel: string;
  local: string;
}

interface ContactPickerProps {
  visible: boolean;
  /** Called with the selected phone number in local format, e.g. "08012345678". */
  onSelect: (phone: string) => void;
  onClose: () => void;
}

type LoadState = "idle" | "loading" | "ready" | "error" | "unavailable";

const MAX_CONTACTS = 1000;

/** "Ade Adeyemi" -> "AA". Empty or single-word names fall back to "?". */
function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * Searchable device-contact picker shown as a bottom sheet. Loads the
 * device address book lazily each time the modal opens and narrows the list
 * as the user types. Only Nigerian numbers are offered, since airtime and
 * data top-ups target Nigerian lines and the parent fields cap input at 11
 * local-format digits.
 */
export function ContactPicker({ visible, onSelect, onClose }: ContactPickerProps) {
  const [search, setSearch] = useState("");
  const [entries, setEntries] = useState<ContactOption[]>([]);
  const [state, setState] = useState<LoadState>("idle");

  async function loadContacts() {
    setSearch("");
    setState("loading");
    try {
      // Intentionally a *dynamic* import: expo-contacts performs a native
      // `requireNativeModule('ExpoContactsNext')` at module-load time, so a
      // top-level import here would put that native-module dependency on the
      // app's startup path and crash every launch on builds that don't
      // register it. Loading it only when the picker opens keeps startup
      // safe — a missing native module falls through to the graceful
      // "unavailable"/"error" states below instead of killing the app.
      const { Contact, ContactField, ContactsSortOrder } = await import("expo-contacts");
      if (typeof Contact?.getAllDetails !== "function") {
        // expo-contacts ships a stub on unsupported platforms (e.g. web).
        setState("unavailable");
        return;
      }
      const details = await Contact.getAllDetails(
        [ContactField.FULL_NAME, ContactField.PHONES],
        { sortOrder: ContactsSortOrder.GivenName, limit: MAX_CONTACTS },
      );

      const seen = new Set<string>();
      const options: ContactOption[] = [];
      for (const detail of details) {
        const fullName = (detail.fullName ?? "").trim();
        const phones = detail.phones ?? [];
        for (let i = 0; i < phones.length; i += 1) {
          const local = e164ToLocalNigeria(toE164Nigeria(phones[i].number ?? ""));
          // Only valid 11-digit local Nigerian numbers fit the parent field.
          if (!/^0\d{10}$/.test(local)) continue;
          if (seen.has(local)) continue;
          seen.add(local);
          options.push({
            key: `${detail.id}-${i}`,
            name: fullName || "No name",
            initials: initialsOf(fullName),
            phoneLabel: phones[i].label ?? "phone",
            local,
          });
        }
      }
      setEntries(options);
      setState("ready");
    } catch {
      // iOS 18+ can deny full contacts access until granted in Settings.
      setState("error");
    }
  }

  useEffect(() => {
    if (!visible) return;
    // Defer past the effect body so the loading state lands on the next
    // frame instead of synchronously within the effect.
    const timer = setTimeout(() => void loadContacts(), 0);
    return () => clearTimeout(timer);
  }, [visible]);

  const query = search.trim().toLowerCase();
  const visibleEntries = query.length > 0
    ? entries.filter((entry) =>
        entry.name.toLowerCase().includes(query) ||
        entry.local.includes(query) ||
        entry.local.slice(1).includes(query),
      )
    : entries;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close contacts" />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose a contact</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close contacts">
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search name or number"
          placeholderTextColor={colors.inkFaint}
          value={search}
          onChangeText={setSearch}
          accessibilityLabel="Search contacts"
        />

        {state === "loading" && (
          <Text style={[styles.stateText, styles.stateTextCenter]}>Loading contacts…</Text>
        )}
        {state === "unavailable" && (
          <Text style={styles.stateText}>Contact access isn&apos;t available on this device.</Text>
        )}
        {state === "error" && (
          <View style={styles.stateRow}>
            <Text style={styles.stateText}>Couldn&apos;t read your contacts. Grant access in system settings and try again.</Text>
            <Pressable
              onPress={() => void loadContacts()}
              accessibilityRole="button"
              style={({ pressed }) => [styles.retry, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        )}
        {state === "ready" && visibleEntries.length === 0 && (
          <Text style={styles.stateText}>
            No {query.length > 0 ? "matching" : ""} contacts found.
          </Text>
        )}
        {state === "ready" && visibleEntries.length > 0 && (
          <FlatList
            data={visibleEntries}
            keyExtractor={(item) => item.key}
            style={styles.list}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${formatLocalForDisplay(item.local)}`}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
                onPress={() => {
                  onSelect(item.local);
                  onClose();
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{item.initials}</Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.rowPhone} numberOfLines={1}>
                    {item.phoneLabel !== "phone" ? `${item.phoneLabel} · ` : ""}
                    {formatLocalForDisplay(item.local)}
                  </Text>
                </View>
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: "80%",
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  title: { fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.ink },
  close: { fontSize: typography.sizes.lg, color: colors.inkSoft, paddingHorizontal: spacing.sm },
  search: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: spacing.lg,
    fontSize: typography.sizes.base,
    color: colors.ink,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  list: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.primary },
  rowBody: { flex: 1 },
  rowName: { fontSize: typography.sizes.base, color: colors.ink, fontWeight: typography.weights.medium },
  rowPhone: { fontSize: typography.sizes.sm, color: colors.inkSoft },
  stateText: { fontSize: typography.sizes.sm, color: colors.inkSoft, marginHorizontal: spacing.lg, marginTop: spacing.md },
  stateTextCenter: { alignSelf: "center" },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  retry: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  retryText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.semibold, color: colors.primary },
});