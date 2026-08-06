"use server";

import type { SetBankAccountState, WithdrawState } from "./admin-wallet-types";

export async function setBankAccountAction(
  _prev: SetBankAccountState,
  formData: FormData,
): Promise<SetBankAccountState> {
  const accountNumber = formData.get("accountNumber");
  const bankCode = formData.get("bankCode");
  const bankName = formData.get("bankName");

  if (typeof accountNumber !== "string" || accountNumber.length < 10) {
    return { error: "Enter a valid 10-digit account number." };
  }
  if (typeof bankCode !== "string" || !bankCode) {
    return { error: "Select a bank." };
  }
  if (typeof bankName !== "string" || !bankName) {
    return { error: "Select a bank." };
  }

  try {
    const { setAdminBankAccount } = await import("@/lib/data/finance");
    await setAdminBankAccount({ accountNumber, bankCode, bankName });
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save bank account.";
    return { error: message };
  }
}

export async function withdrawAction(
  _prev: WithdrawState,
  formData: FormData,
): Promise<WithdrawState> {
  const amountRaw = formData.get("amount");
  const amount = typeof amountRaw === "string" ? parseInt(amountRaw, 10) : NaN;

  if (isNaN(amount) || amount < 1) {
    return { error: "Enter a valid amount (minimum ₦1)." };
  }

  try {
    const { adminWithdraw } = await import("@/lib/data/finance");
    const result = await adminWithdraw(amount);
    return {
      successMessage: `Withdrawal initiated: ₦${amount.toLocaleString()} — ${result.status} (ref: ${result.transferCode})`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Withdrawal failed.";
    return { error: message };
  }
}