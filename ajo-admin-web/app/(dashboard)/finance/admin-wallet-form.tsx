"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/format";
import type { AdminWalletSummary } from "@/lib/data/finance";
import { setBankAccountAction, withdrawAction } from "./admin-wallet-actions";
import type { SetBankAccountState, WithdrawState } from "./admin-wallet-types";

// ---- Bank account setup form --------------------------------------------------

function SetBankAccountSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Save bank account"}
    </Button>
  );
}

export function SetBankAccountForm({
  banks,
  onSuccess,
}: {
  banks: Array<{ name: string; code: string }>;
  onSuccess: () => void;
}) {
  const [state, formAction] = useActionState(setBankAccountAction, {});

  useEffect(() => {
    if (state.success) {
      onSuccess();
    }
  }, [state.success, onSuccess]);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="bankName">Bank</Label>
        <select
          id="bankName"
          name="bankName"
          required
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
          onChange={(e) => {
            const selected = e.target.selectedOptions[0];
            const codeInput = document.getElementById("bankCode") as HTMLInputElement | null;
            if (codeInput) codeInput.value = selected?.dataset?.code ?? "";
          }}
        >
          <option value="">Select a bank</option>
          {banks.map((b) => (
            <option key={b.code} value={b.name} data-code={b.code}>
              {b.name}
            </option>
          ))}
        </select>
        <input id="bankCode" name="bankCode" type="hidden" />
      </div>

      <div>
        <Label htmlFor="accountNumber">Account number</Label>
        <Input
          id="accountNumber"
          name="accountNumber"
          type="text"
          required
          maxLength={10}
          pattern="\d{10}"
          placeholder="0123456789"
        />
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-success">
          Bank account saved.
        </p>
      )}

      <SetBankAccountSubmitButton />
    </form>
  );
}

// ---- Withdraw form -----------------------------------------------------------

function WithdrawSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variant="primary">
      {pending ? "Processing…" : "Withdraw"}
    </Button>
  );
}

export function WithdrawForm({ balance }: { balance: number }) {
  const [state, formAction] = useActionState(withdrawAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <Label htmlFor="amount">Amount (₦)</Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          required
          min={1}
          max={balance}
          placeholder="Enter amount"
        />
        <p className="text-xs text-ink-soft mt-1">
          Available balance: ₦{(balance || 0).toLocaleString()}
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

      <WithdrawSubmitButton />
    </form>
  );
}

// ---- Bill commission credits table -------------------------------------------

export function BillCommissionCreditsTable({
  credits,
}: {
  credits: AdminWalletSummary["recentBillCommissionCredits"];
}) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-3 border-b border-line">
        <h3 className="text-sm font-medium text-ink">Recent Bill Commission Credits</h3>
      </div>
      {credits.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="No bill commission credits yet"
            description="Commissions from bill payments (the difference between what users paid and the actual VTPass cost) will appear here."
          />
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-5 py-3 font-medium">Bill Type</th>
              <th className="px-5 py-3 font-medium">User Paid</th>
              <th className="px-5 py-3 font-medium">Actual Cost</th>
              <th className="px-5 py-3 font-medium">Commission</th>
              <th className="px-5 py-3 font-medium">Balance after</th>
              <th className="px-5 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {credits.map((tx) => (
              <tr
                key={tx.id}
                className="border-b border-line last:border-0 hover:bg-canvas transition-colors"
              >
                <td className="px-5 py-3">
                  <span className="capitalize font-medium text-ink">{tx.billType}</span>
                </td>
                <td className="px-5 py-3 font-mono text-ink-soft">
                  {formatCurrency(tx.userPaid)}
                </td>
                <td className="px-5 py-3 font-mono text-ink-soft">
                  {formatCurrency(tx.actualCost)}
                </td>
                <td className="px-5 py-3 font-mono text-success font-medium">
                  {formatCurrency(tx.amount)}
                </td>
                <td className="px-5 py-3 font-mono text-ink-soft">
                  {formatCurrency(tx.balanceAfter)}
                </td>
                <td className="px-5 py-3 text-ink-soft">{formatDate(tx.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ---- Combined admin wallet component -----------------------------------------

export function AdminWalletForms({
  wallet,
  banks,
}: {
  wallet: AdminWalletSummary;
  banks: Array<{ name: string; code: string }>;
}) {
  const [showBankForm, setShowBankForm] = useState(!wallet.bankAccount);

  const handleBankSaved = () => {
    setShowBankForm(false);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Balance & bank account summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">Available Balance</p>
          <p className="text-2xl font-bold text-ink">
            ₦{(wallet.balance || 0).toLocaleString()}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">Commission Balance</p>
          <p className="text-2xl font-bold text-success">
            ₦{(wallet.totalCommissionBalance || 0).toLocaleString()}
          </p>
          <p className="text-xs text-ink-soft mt-1">From bills commission</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs uppercase tracking-wide text-ink-soft mb-1">Bank Account</p>
          {wallet.bankAccount ? (
            <div className="text-sm text-ink">
              <p className="font-medium">{wallet.bankAccount.bankName}</p>
              <p className="font-mono text-ink-soft">{wallet.bankAccount.accountNumber}</p>
              <p className="text-ink-soft">{wallet.bankAccount.accountName}</p>
            </div>
          ) : (
            <p className="text-sm text-ink-soft">Not set</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bank account setup */}
        <Card className="p-5">
          <h3 className="text-sm font-medium text-ink mb-3">
            {wallet.bankAccount ? "Change Bank Account" : "Set Bank Account"}
          </h3>
          {wallet.bankAccount && !showBankForm ? (
            <div className="space-y-3">
              <p className="text-sm text-ink-soft">
                Withdrawals will be sent to your registered bank account above.
              </p>
              <Button variant="secondary" onClick={() => setShowBankForm(true)}>
                Change bank account
              </Button>
            </div>
          ) : (
            <SetBankAccountForm banks={banks} onSuccess={handleBankSaved} />
          )}
        </Card>

        {/* Withdraw */}
        <Card className="p-5">
          <h3 className="text-sm font-medium text-ink mb-3">Withdraw Funds</h3>
          {wallet.bankAccount ? (
            <WithdrawForm balance={wallet.balance} />
          ) : (
            <p className="text-sm text-ink-soft">
              Set a bank account first to withdraw funds.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}