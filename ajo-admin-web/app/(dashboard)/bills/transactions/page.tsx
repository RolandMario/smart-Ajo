import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { listBillTransactions } from "@/lib/data/bills";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  billServiceTypeLabel,
  billStatusLabel,
  billStatusTone,
} from "@/lib/status-display";
import type { BillServiceType, BillStatus } from "@/lib/types/api";
import { BillsNav } from "../bills-nav";

export const dynamic = "force-dynamic";

const SERVICE_FILTERS: { label: string; value?: BillServiceType }[] = [
  { label: "All", value: undefined },
  { label: "Airtime", value: "airtime" },
  { label: "Data", value: "data" },
  { label: "Cable TV", value: "cable" },
  { label: "Electricity", value: "electricity" },
];

const STATUS_FILTERS: { label: string; value?: BillStatus }[] = [
  { label: "All", value: undefined },
  { label: "Successful", value: "success" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
];

export default async function BillsTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceType?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const activeType = (
    SERVICE_FILTERS.some((f) => f.value === params.serviceType)
      ? params.serviceType
      : undefined
  ) as BillServiceType | undefined;
  const activeStatus = (
    STATUS_FILTERS.some((f) => f.value === params.status)
      ? params.status
      : undefined
  ) as BillStatus | undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const { transactions, total, totalPages } = await listBillTransactions({
    serviceType: activeType,
    status: activeStatus,
    page,
    limit: 20,
  });

  function filterHref(nextType?: BillServiceType, nextStatus?: BillStatus) {
    const q = new URLSearchParams();
    if (nextType) q.set("serviceType", nextType);
    if (nextStatus) q.set("status", nextStatus);
    const qs = q.toString();
    return qs ? `/bills/transactions?${qs}` : "/bills/transactions";
  }

  function buildHref(targetPage: number) {
    const q = new URLSearchParams();
    if (activeType) q.set("serviceType", activeType);
    if (activeStatus) q.set("status", activeStatus);
    q.set("page", String(targetPage));
    return `/bills/transactions?${q.toString()}`;
  }

  const heading = [
    activeType ? billServiceTypeLabel(activeType) : null,
    activeStatus ? `${billStatusLabel(activeStatus).toLowerCase()} transactions` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title="Bill Transactions"
        description="Every bill payment made by members across the platform — airtime, data, cable, and electricity. Click a row to open the full transaction receipt."
      />
      <BillsNav active="transactions" />

      <div className="p-8 space-y-6 max-w-6xl">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {SERVICE_FILTERS.map((f) => {
              const active = (f.value ?? "") === (activeType ?? "");
              return (
                <Link
                  key={f.label}
                  href={filterHref(f.value, activeStatus)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium border ${
                    active
                      ? "bg-ink text-white border-ink"
                      : "bg-surface text-ink border-line hover:bg-canvas"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => {
              const active = (f.value ?? "") === (activeStatus ?? "");
              return (
                <Link
                  key={f.label}
                  href={filterHref(activeType, f.value)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium border ${
                    active
                      ? "bg-ink text-white border-ink"
                      : "bg-surface text-ink border-line hover:bg-canvas"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="px-6 py-4 border-b border-line">
            <h2 className="font-display text-lg font-semibold text-ink">
              {heading ? `${heading} (${total})` : `All transactions (${total})`}
            </h2>
          </div>

          {transactions.length === 0 ? (
            <EmptyState
              title="No bill transactions"
              description="Once members pay for airtime, data, cable, or electricity, those transactions will show up here."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Service</th>
                  <th className="px-6 py-3 font-medium">Recipient</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-b border-line last:border-0 hover:bg-canvas transition-colors"
                  >
                    <td className="px-6 py-3">
                      <Link
                        href={`/bills/transactions/${tx.id}`}
                        className="group font-medium text-ink"
                      >
                        <span className="block group-hover:text-accent transition-colors">
                          {tx.user.name ?? tx.user.phone}
                        </span>
                        <span className="block text-xs font-normal text-ink-soft">
                          {tx.user.name ? tx.user.phone : tx.user.id.slice(-6)}
                        </span>
                      </Link>
                    </td>
                    <td className="px-6 py-3 text-ink">
                      {billServiceTypeLabel(tx.type)}
                    </td>
                    <td className="px-6 py-3 text-ink-soft">{tx.recipient}</td>
                    <td className="px-6 py-3 font-mono text-ink">
                      {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-6 py-3">
                      <Badge tone={billStatusTone(tx.status)}>
                        {billStatusLabel(tx.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-3 text-ink-soft">{formatDate(tx.createdAt)}</td>
                    <td className="px-6 py-3">
                      <Link
                        href={`/bills/transactions/${tx.id}`}
                        className="block font-mono text-xs text-ink-soft max-w-[180px] truncate hover:text-accent transition-colors"
                        title={tx.reference}
                      >
                        {tx.reference}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {transactions.length > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} buildHref={buildHref} />
        )}

        {(activeType || activeStatus) && (
          <p className="text-xs text-ink-soft">
            Showing{" "}
            <span className="font-medium">
              {[
                activeType ? billServiceTypeLabel(activeType) : null,
                activeStatus ? billStatusLabel(activeStatus).toLowerCase() : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>{" "}
            transactions only.
          </p>
        )}
      </div>
    </>
  );
}