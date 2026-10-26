"use server";

import type { UpdateServiceChargesState } from "./service-charges-types";

/** Parses a percentage from the form, returning undefined when invalid. */
function parsePercent(value: FormDataEntryValue | null): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * The API only stores rates with two decimal places (`1.25`), so reject
 * anything more precise here rather than surfacing a validation error
 * straight from the server.
 */
function hasTooManyDecimals(value: FormDataEntryValue | null): boolean {
  if (typeof value !== "string") return false;

  const [, decimals = ""] = value.trim().split(".");

  return decimals.length > 2;
}

export async function updateServiceChargesAction(
  _prev: UpdateServiceChargesState,
  formData: FormData,
): Promise<UpdateServiceChargesState> {
  const transferRaw = formData.get("escrowTransferFeePercent");
  const payoutRaw = formData.get("payoutFeePercent");

  if (hasTooManyDecimals(transferRaw) || hasTooManyDecimals(payoutRaw)) {
    return { error: "Rates can have at most 2 decimal places (e.g. 2.5)." };
  }

  const escrowTransferFeePercent = parsePercent(transferRaw);
  const payoutFeePercent = parsePercent(payoutRaw);

  if (escrowTransferFeePercent === undefined) {
    return { error: "Enter a transfer fee between 0 and 100." };
  }
  if (payoutFeePercent === undefined) {
    return { error: "Enter a payout fee between 0 and 100." };
  }
  if (
    escrowTransferFeePercent < 0 ||
    escrowTransferFeePercent > 100 ||
    payoutFeePercent < 0 ||
    payoutFeePercent > 100
  ) {
    return { error: "Rates must be between 0% and 100%." };
  }

  try {
    const { updateServiceCharges } = await import("@/lib/data/finance");
    const charges = await updateServiceCharges({
      escrowTransferFeePercent,
      payoutFeePercent,
    });

    return {
      successMessage: `Service charges saved: ${charges.escrowTransferFeePercent}% on transfers, ${charges.payoutFeePercent}% on payouts.`,
      charges,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to save service charges.";
    return { error: message };
  }
}
