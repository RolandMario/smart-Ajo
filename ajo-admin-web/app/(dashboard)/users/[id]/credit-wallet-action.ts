"use server";

export interface CreditWalletState {
  success?: boolean;
  successMessage?: string;
  error?: string;
}

export async function creditWalletAction(
  _prev: CreditWalletState,
  formData: FormData,
): Promise<CreditWalletState> {
  const userId = formData.get("userId");
  const amountRaw = formData.get("amount");
  const note = formData.get("note");

  const amount = typeof amountRaw === "string" ? parseInt(amountRaw, 10) : NaN;
  if (typeof userId !== "string" || !userId) {
    return { error: "Missing user." };
  }
  if (isNaN(amount) || amount < 1) {
    return { error: "Enter a valid amount (minimum ₦1)." };
  }

  try {
    const { creditUserWallet } = await import("@/lib/data/users");
    const result = await creditUserWallet(
      userId,
      amount,
      typeof note === "string" && note.trim() ? note : undefined,
    );
    return {
      success: true,
      successMessage: `Credited ₦${amount.toLocaleString()} — new balance ₦${result.balance.toLocaleString()}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to credit wallet.";
    return { error: message };
  }
}
