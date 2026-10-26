"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { ServiceCharges } from "@/lib/data/finance";
import { updateServiceChargesAction } from "./service-charges-actions";

/** Whole-naira percentage fee — mirrors the server's rounding rule. */
function feeFor(amount: number, percent: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(percent)) return 0;
  if (amount <= 0 || percent <= 0) return 0;

  return Math.min(Math.round((amount * percent) / 100), Math.floor(amount));
}

/** Sample amount used in the live preview below the form. */
const SAMPLE_AMOUNT = 10000;

function SaveSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save service charges"}
    </Button>
  );
}

export function ServiceChargesForm({ charges }: { charges: ServiceCharges }) {
  const router = useRouter();
  const [state, formAction] = useActionState(updateServiceChargesAction, {});

  const [transferRate, setTransferRate] = useState(
    String(charges.escrowTransferFeePercent),
  );
  const [payoutRate, setPayoutRate] = useState(
    String(charges.payoutFeePercent),
  );

  useEffect(() => {
    if (state.charges) {
      // Re-render the tab with the rates the server actually stored.
      router.refresh();
    }
  }, [state.charges, router]);

  const transferPercent = Number(transferRate);
  const payoutPercent = Number(payoutRate);

  const transferFee = feeFor(SAMPLE_AMOUNT, transferPercent);
  const payoutFee = feeFor(SAMPLE_AMOUNT, payoutPercent);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="p-5">
        <h3 className="text-sm font-medium text-ink mb-1">Platform Service Charges</h3>
        <p className="text-xs text-ink-soft mb-4">
          Percentages applied to every transfer. Changes take effect
          immediately — the rate is read from these settings on each transfer
          and payout.
        </p>

        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="escrowTransferFeePercent">
              Escrow transfer fee (%)
            </Label>
            <Input
              id="escrowTransferFeePercent"
              name="escrowTransferFeePercent"
              type="number"
              required
              min={0}
              max={100}
              step="0.01"
              value={transferRate}
              onChange={(e) => setTransferRate(e.target.value)}
            />
            <p className="text-xs text-ink-soft mt-1">
              Charged to the member on top of every wallet → escrow transfer
              (group contributions and pool donations).
            </p>
          </div>

          <div>
            <Label htmlFor="payoutFeePercent">Bank payout fee (%)</Label>
            <Input
              id="payoutFeePercent"
              name="payoutFeePercent"
              type="number"
              required
              min={0}
              max={100}
              step="0.01"
              value={payoutRate}
              onChange={(e) => setPayoutRate(e.target.value)}
            />
            <p className="text-xs text-ink-soft mt-1">
              Deducted from every bank payout out of escrow (cycle payouts and
              donation pool payouts) — the recipient receives the amount minus
              this fee.
            </p>
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-danger">
              {state.error}
            </p>
          )}
          {state.successMessage && (
            <p role="status" className="text-sm text-success">
              {state.successMessage}
            </p>
          )}

          <SaveSubmitButton />
        </form>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-medium text-ink mb-3">
          Preview on {formatCurrency(SAMPLE_AMOUNT)}
        </h3>

        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-soft">
              Wallet → escrow transfer
            </dt>
            <dd className="text-ink">
              Member is debited{" "}
              <span className="font-mono font-medium">
                {formatCurrency(SAMPLE_AMOUNT + transferFee)}
              </span>{" "}
              — {formatCurrency(SAMPLE_AMOUNT)} funds escrow,{" "}
              <span className="font-mono">{formatCurrency(transferFee)}</span>{" "}
              platform fee ({Number.isFinite(transferPercent) ? transferPercent : 0}
              %).
            </dd>
          </div>

          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-soft">
              Bank payout
            </dt>
            <dd className="text-ink">
              Recipient receives{" "}
              <span className="font-mono font-medium">
                {formatCurrency(Math.max(SAMPLE_AMOUNT - payoutFee, 0))}
              </span>{" "}
              — {formatCurrency(SAMPLE_AMOUNT)} is debited from escrow,{" "}
              <span className="font-mono">{formatCurrency(payoutFee)}</span>{" "}
              platform fee ({Number.isFinite(payoutPercent) ? payoutPercent : 0}
              %).
            </dd>
          </div>
        </dl>

        <p className="text-xs text-ink-soft mt-4">
          Fees are rounded to whole naira and can never exceed the amount moved.
          A payout rate that would leave ₦0 for the recipient is rejected, so
          100% cannot be used on bank payouts.
        </p>
      </Card>
    </div>
  );
}
