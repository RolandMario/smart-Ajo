"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { creditWalletAction, type CreditWalletState } from "./credit-wallet-action";

function CreditWalletSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="primary">
      {pending ? "Crediting…" : "Credit wallet"}
    </Button>
  );
}

export function CreditWalletForm({
  userId,
  currentBalance,
  currency,
}: {
  userId: string;
  currentBalance: number;
  currency: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState<CreditWalletState, FormData>(
    creditWalletAction,
    {},
  );

  // After a successful credit, refresh the server component so the shown
  // wallet balance reflects the new value.
  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <Card className="p-5">
      <h3 className="text-sm font-medium text-ink mb-1">Credit wallet</h3>
      <p className="text-sm text-ink-soft mb-3">
        Add funds to this member&apos;s wallet directly. A ledger entry is
        recorded for this action.
      </p>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="userId" value={userId} />
        <div>
          <Label htmlFor="amount">Amount (₦)</Label>
          <Input
            id="amount"
            name="amount"
            type="number"
            required
            min={1}
            placeholder="Enter amount"
          />
          <p className="text-xs text-ink-soft mt-1">
            Current balance: {currency}{" "}
            {(currentBalance || 0).toLocaleString()}
          </p>
        </div>
        <div>
          <Label htmlFor="note">Note (optional)</Label>
          <Input
            id="note"
            name="note"
            type="text"
            placeholder="e.g. Support credit"
          />
          <p className="text-xs text-ink-soft mt-1">
            Shown only in the admin ledger for audit.
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

        <CreditWalletSubmitButton />
      </form>
    </Card>
  );
}
