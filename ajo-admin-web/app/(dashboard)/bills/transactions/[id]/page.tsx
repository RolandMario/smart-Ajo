import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { getBillTransaction } from "@/lib/data/bills";
import { formatCurrency } from "@/lib/format";
import {
  billReceiptRows,
  billServiceTypeLabel,
  billStatusLabel,
  billStatusTone,
} from "@/lib/status-display";
import type { PlatformBillTransaction } from "@/lib/types/api";
import { BillsNav } from "../../bills-nav";
import { ShareReceiptButton } from "./share-receipt-button";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ReceiptRow({
  label,
  value,
  mono = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-2.5">
      <dt className="text-sm text-ink-soft shrink-0">{label}</dt>
      <dd
        className={`text-right ${
          emphasis
            ? "font-mono text-lg font-semibold text-accent"
            : mono
              ? "font-mono text-xs text-ink leading-relaxed break-all"
              : "text-sm font-medium text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

export default async function BillTransactionReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let tx: PlatformBillTransaction;
  try {
    tx = await getBillTransaction(id);
  } catch {
    notFound();
  }

  const tone = billStatusTone(tx.status);
  const statusToneClasses: Record<typeof tone, string> = {
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
    neutral: "bg-canvas text-ink-soft border border-line",
    accent: "bg-accent-soft text-accent",
  };

  return (
    <>
      <PageHeader
        title="Transaction Receipt"
        description={`Bill payment receipt for ${tx.user.name ?? "a member"} (${tx.user.phone}).`}
        actions={
          <>
            <ShareReceiptButton reference={tx.reference} />
            <Link
              href="/bills/transactions"
              className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-ink hover:bg-canvas"
            >
              Back to transactions
            </Link>
          </>
        }
      />
      <BillsNav active="transactions" />

      <div className="p-8 flex justify-center">
        <div className="w-full max-w-lg">
          {/* Receipt — captured by the Share receipt button */}
          <div
            id="receipt-panel"
            className="rounded-lg border border-line bg-surface shadow-sm overflow-hidden"
          >
            <div className="px-8 py-6 border-b border-line">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-ink text-white flex items-center justify-center font-display text-lg">
                  A
                </div>
                <div>
                  <p className="font-display text-lg font-semibold text-ink leading-tight">Ajo</p>
                  <p className="text-xs text-ink-soft">Bill payment receipt</p>
                </div>
              </div>
              <div className="mt-5 h-1 w-full rounded-full bg-accent" />
            </div>

            <div className="px-8 py-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-semibold text-ink">
                  {billServiceTypeLabel(tx.type)}
                </h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusToneClasses[tone]}`}>
                  {billStatusLabel(tx.status)}
                </span>
              </div>

              <div className="mt-4 border-b border-line pb-2 mb-1">
                <ReceiptRow label="Amount" value={formatCurrency(tx.amount)} emphasis />
              </div>

              <dl className="divide-y divide-line">
                <ReceiptRow
                  label="Customer"
                  value={
                    tx.user.name
                      ? `${tx.user.name} · ${tx.user.phone}`
                      : tx.user.phone
                  }
                />
                {billReceiptRows(tx).map((row) => (
                  <ReceiptRow key={row.label} label={row.label} value={row.value} />
                ))}
                <ReceiptRow label="Processor" value="Smart Env" />
                <ReceiptRow label="Reference" value={tx.reference} mono />
                {tx.externalReference ? (
                  <ReceiptRow label="External Ref" value={tx.externalReference} mono />
                ) : null}
                <ReceiptRow label="Date" value={formatDateTime(tx.createdAt)} />
              </dl>

              <div className="mt-6 pt-4 border-t border-dashed border-line text-center">
                <p className="text-xs text-ink-soft">Thank you for using Ajo.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}