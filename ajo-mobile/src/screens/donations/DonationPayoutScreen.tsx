import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import type { DonationsStackParamList } from "../../navigation/types";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ErrorBanner } from "../../components/ErrorBanner";
import { LoadingScreen } from "../../components/LoadingScreen";
import { Pagination } from "../../components/Pagination";
import { ApiError } from "../../api/api-error";
import {
  DONATION_PAGE_SIZE,
  getDonationPayoutAccount,
  initiateDonationPayout,
  listDonationPayouts,
  setDonationPayoutAccount,
} from "../../api/donations";
import { listBanks } from "../../api/wallet";
import type {
  BankListEntry,
  DonationPayout,
  DonationPayoutSetup,
} from "../../types/api";
import { colors, radii, spacing, typography } from "../../theme";
import { formatDateTime, formatNaira } from "../../utils/format";

type Props = NativeStackScreenProps<DonationsStackParamList, "DonationPayout">;

/** Mirrors the server's DONATION_PAYOUT_MIN_AMOUNT. */
const MIN_PAYOUT = 100;

function payoutStatusStyle(status: DonationPayout["status"]) {
  switch (status) {
    case "success":
      return {
        label: "Paid",
        color: colors.success,
        background: colors.successSoft,
      };
    case "pending":
      return {
        label: "Processing",
        color: colors.warning,
        background: colors.warningSoft,
      };
    case "failed":
    case "reversed":
      return {
        label: status === "failed" ? "Failed" : "Reversed",
        color: colors.danger,
        background: colors.dangerSoft,
      };
    default:
      return {
        label: status,
        color: colors.forestLightInkSoft,
        background: colors.forestLightPill,
      };
  }
}

/**
 * Admin-only payout console: where the money goes, how much is in escrow, the
 * payout action, and the transfer history.
 */
export function DonationPayoutScreen({ route }: Props) {
  const { groupId, groupName } = route.params;

  const [setup, setSetup] = useState<DonationPayoutSetup | null>(null);
  const [payouts, setPayouts] = useState<DonationPayout[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [escrow, setEscrow] = useState(0);
  const [paidOut, setPaidOut] = useState(0);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [paging, setPaging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Destination picker
  const [destOpen, setDestOpen] = useState(false);
  const [mode, setMode] = useState<"menu" | "banks">("menu");
  const [banks, setBanks] = useState<BankListEntry[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankQuery, setBankQuery] = useState("");
  const [selectedBank, setSelectedBank] = useState<BankListEntry | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [savingDest, setSavingDest] = useState(false);

  const fetchData = useCallback(
    async (targetPage: number, initial = false) => {
      if (initial) setLoading(true);
      try {
        const [history, accountSetup] = await Promise.all([
          listDonationPayouts(groupId, targetPage, DONATION_PAGE_SIZE),
          getDonationPayoutAccount(groupId),
        ]);
        setPayouts(history.payouts);
        setPage(history.page);
        setTotalPages(Math.max(1, history.totalPages));
        setTotal(history.total);
        setEscrow(history.escrowBalance);
        setPaidOut(history.totalPaidOut);
        setSetup(accountSetup);
        setAmount((prev) =>
          prev === "" ? String(history.escrowBalance) : prev,
        );
        setError(null);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load payouts");
        }
      } finally {
        if (initial) setLoading(false);
      }
    },
    [groupId],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchData(1, true);
    }, [fetchData]),
  );

  async function handlePage(next: number) {
    if (next === page) return;
    setPaging(true);
    try {
      await fetchData(next);
    } finally {
      setPaging(false);
    }
  }

  function handlePayout() {
    const value = parseInt(amount, 10);
    if (!value || value < MIN_PAYOUT) {
      setError(`Enter at least ${formatNaira(MIN_PAYOUT)} to pay out.`);
      return;
    }
    if (value > escrow) {
      setError("You cannot pay out more than the pool balance.");
      return;
    }
    if (!setup?.destination) {
      setError("Add a payout bank account first.");
      return;
    }

    const destination = setup.destination;
    Alert.alert(
      "Confirm payout",
      `Send ${formatNaira(value)} to ${destination.bankName} • ${
        destination.accountNumber
      } (${destination.accountName})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Pay out",
          onPress: () => {
            void runPayout(value);
          },
        },
      ],
    );
  }

  async function runPayout(value: number) {
    setError(null);
    setBusy(true);
    try {
      await initiateDonationPayout(groupId, value);
      Alert.alert(
        "Payout initiated",
        "The money is on its way to the bank account. You'll get a notification when it lands.",
      );
      await fetchData(1);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Payout failed. The money is still in the pool.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function openDestination() {
    setDestOpen(true);
    setMode("menu");
    setBankQuery("");
    setSelectedBank(null);
    setAccountNumber("");
    if (banks.length === 0) {
      setBanksLoading(true);
      try {
        setBanks(await listBanks());
      } catch {
        Alert.alert(
          "Bank list unavailable",
          "Check your connection and try again.",
        );
      } finally {
        setBanksLoading(false);
      }
    }
  }

  async function applyAdminAccount() {
    setSavingDest(true);
    setError(null);
    try {
      setSetup(
        await setDonationPayoutAccount(groupId, { useAdminAccount: true }),
      );
      setDestOpen(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not update the payout account.";
      setError(message);
      Alert.alert("Could not update destination", message);
    } finally {
      setSavingDest(false);
    }
  }

  async function savePoolAccount() {
    if (!selectedBank) {
      setError("Choose the bank for this payout account.");
      return;
    }
    if (accountNumber.length !== 10) {
      setError("Account number must be 10 digits.");
      return;
    }

    setSavingDest(true);
    setError(null);
    try {
      setSetup(
        await setDonationPayoutAccount(groupId, {
          bankName: selectedBank.name,
          bankCode: selectedBank.code,
          accountNumber,
        }),
      );
      setDestOpen(false);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not save the payout account.";
      setError(message);
      Alert.alert("Could not save destination", message);
    } finally {
      setSavingDest(false);
    }
  }

  if (loading) {
    return <LoadingScreen />;
  }

  const destination = setup?.destination ?? null;
  const adminAccount = setup?.adminAccount ?? null;
  const filteredBanks = banks.filter((bank) =>
    bank.name.toLowerCase().includes(bankQuery.trim().toLowerCase()),
  );


  return (
    <Screen scrollable={false}>
      <FlatList
        data={payouts}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>{groupName ?? "Payouts"}</Text>
            <Text style={styles.subtitle}>
              {"Withdraw the pool's escrow to a bank account."}
            </Text>

            {error && <ErrorBanner message={error} />}

            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Available to pay out</Text>
              <Text style={styles.summaryValue}>{formatNaira(escrow)}</Text>
              <Text style={styles.summaryMeta}>
                Paid out so far · {formatNaira(paidOut)}
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Destination</Text>
              {destination ? (
                <>
                  <Text style={styles.destinationBank}>
                    {destination.bankName}
                  </Text>
                  <Text style={styles.destinationMeta}>
                    {destination.accountNumber} · {destination.accountName}
                  </Text>
                  <Text style={styles.hint}>
                    {destination.source === "pool"
                      ? "Account set for this pool."
                      : "The bank account saved on your profile."}
                  </Text>
                </>
              ) : (
                <Text style={styles.hint}>
                  No payout account yet. Choose one to start withdrawing.
                </Text>
              )}
              <Button
                title={
                  destination ? "Change destination" : "Choose destination"
                }
                variant="secondary"
                icon="business-outline"
                onPress={openDestination}
                style={styles.smallButton}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Pay out</Text>
              <TextInput
                style={styles.amountInput}
                keyboardType="number-pad"
                placeholder="Amount"
                placeholderTextColor={colors.forestLightInkFaint}
                value={amount}
                onChangeText={setAmount}
                editable={escrow > 0}
              />
              <Text style={styles.hint}>
                Keep the full balance to withdraw everything in the pool.
              </Text>
              <Button
                title="Pay out"
                icon="cash-outline"
                onPress={handlePayout}
                loading={busy}
                disabled={escrow < MIN_PAYOUT || !destination}
                style={styles.smallButton}
              />
            </View>

            <Text style={styles.sectionTitle}>Payout history</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No payouts yet. Once you pay out, the transfers will appear here.
          </Text>
        }
        renderItem={({ item }) => {
          const status = payoutStatusStyle(item.status);
          return (
            <View style={styles.row}>
              <View style={styles.rowInfo}>
                <Text style={styles.rowAmount}>{formatNaira(item.amount)}</Text>
                <Text style={styles.rowMeta}>
                  {formatDateTime(item.createdAt)} · {item.bankName} ••••{" "}
                  {item.accountNumber.slice(-4)}
                </Text>
                {item.failureReason && (
                  <Text style={styles.rowError}>{item.failureReason}</Text>
                )}
              </View>
              <Text
                style={[
                  styles.statusPill,
                  { color: status.color, backgroundColor: status.background },
                ]}
              >
                {status.label}
              </Text>
            </View>
          );
        }}
        ListFooterComponent={
          <Pagination
            page={page}
            pageCount={totalPages}
            onChange={handlePage}
            total={total}
            pageSize={DONATION_PAGE_SIZE}
            loading={paging}
          />
        }
      />


      <Modal
        visible={destOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDestOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {mode === "menu" ? (
              <>
                <Text style={styles.modalTitle}>Payout destination</Text>
                <Text style={styles.modalSubtitle}>
                  {"Where should this pool's money be sent?"}
                </Text>

                <Pressable
                  style={[
                    styles.optionCard,
                    destination?.source === "admin" && styles.optionActive,
                  ]}
                  onPress={() => {
                    void applyAdminAccount();
                  }}
                  disabled={savingDest}
                >
                  <Text style={styles.optionTitle}>My saved bank account</Text>
                  <Text style={styles.optionHint}>
                    {adminAccount
                      ? `${adminAccount.bankName} · ${adminAccount.accountNumber}`
                      : "No saved account yet — add one in your wallet first."}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.optionCard,
                    destination?.source === "pool" && styles.optionActive,
                  ]}
                  onPress={() => setMode("banks")}
                >
                  <Text style={styles.optionTitle}>Another account</Text>
                  <Text style={styles.optionHint}>
                    Use a different bank account for this pool
                  </Text>
                </Pressable>

                <Button
                  title="Cancel"
                  variant="ghost"
                  onPress={() => setDestOpen(false)}
                  style={styles.modalCancel}
                />
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>Choose bank</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Search banks"
                  placeholderTextColor={colors.forestLightInkFaint}
                  value={bankQuery}
                  onChangeText={setBankQuery}
                />
                <ScrollView
                  style={styles.bankList}
                  keyboardShouldPersistTaps="handled"
                >
                  {filteredBanks.length === 0 ? (
                    <Text style={styles.hint}>
                      {banksLoading ? "Loading banks…" : "No banks found."}
                    </Text>
                  ) : (
                    filteredBanks.map((bank) => (
                      <Pressable
                        key={`${bank.code}-${bank.name}`}
                        style={[
                          styles.bankRow,
                          selectedBank?.code === bank.code &&
                            styles.bankRowActive,
                        ]}
                        onPress={() => setSelectedBank(bank)}
                      >
                        <Text style={styles.bankName}>{bank.name}</Text>
                        {selectedBank?.code === bank.code && (
                          <Text style={styles.check}>✓</Text>
                        )}
                      </Pressable>
                    ))
                  )}
                </ScrollView>
                <TextInput
                  style={styles.modalInput}
                  placeholder="10-digit account number"
                  placeholderTextColor={colors.forestLightInkFaint}
                  keyboardType="number-pad"
                  maxLength={10}
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                />
                <Button
                  title="Save destination"
                  onPress={savePoolAccount}
                  loading={savingDest}
                  disabled={!selectedBank || accountNumber.length !== 10}
                />
                <Button
                  title="Back"
                  variant="ghost"
                  onPress={() => setMode("menu")}
                  style={styles.modalCancel}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}


const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    color: colors.forestLightInk,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.forest,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.onForestMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  summaryValue: {
    fontSize: typography.sizes.xxxl,
    fontWeight: typography.weights.bold,
    color: colors.white,
    marginTop: spacing.xs,
  },
  summaryMeta: {
    fontSize: typography.sizes.xs,
    color: colors.onForestMuted,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInkFaint,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  destinationBank: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  destinationMeta: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: 2,
  },
  hint: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  smallButton: {
    marginTop: spacing.md,
  },
  amountInput: {
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    backgroundColor: colors.forestLightField,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.lg,
    color: colors.forestLightInk,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkFaint,
    fontStyle: "italic",
    paddingVertical: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowAmount: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  rowMeta: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkFaint,
    marginTop: 2,
  },
  rowError: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
    marginTop: 2,
  },
  statusPill: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 33, 26, 0.45)",
    justifyContent: "center",
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  modalSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInkSoft,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  optionCard: {
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionActive: {
    borderColor: colors.forestAction,
    backgroundColor: colors.forestLightPill,
  },
  optionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.forestLightInk,
  },
  optionHint: {
    fontSize: typography.sizes.xs,
    color: colors.forestLightInkSoft,
    marginTop: 2,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    backgroundColor: colors.forestLightField,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.base,
    color: colors.forestLightInk,
    marginTop: spacing.sm,
  },
  bankList: {
    maxHeight: 220,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.forestLightLine,
    borderRadius: radii.md,
  },
  bankRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.forestLightLine,
  },
  bankRowActive: {
    backgroundColor: colors.forestLightPill,
  },
  bankName: {
    fontSize: typography.sizes.sm,
    color: colors.forestLightInk,
  },
  check: {
    fontSize: typography.sizes.base,
    color: colors.forestAction,
    fontWeight: typography.weights.bold,
  },
  modalCancel: {
    marginTop: spacing.xs,
  },
});

