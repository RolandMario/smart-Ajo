import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { listBillsPlans } from "@/lib/data/bills";
import { formatCurrency } from "@/lib/format";
import type { BillServiceType } from "@/lib/types/api";
import { PlanActiveToggle } from "../plan-active-toggle";
import { PlanCashbackInput } from "../plan-cashback-input";
import { BillsNav } from "../bills-nav";

export const dynamic = "force-dynamic";

const SERVICE_FILTERS: { label: string; value?: BillServiceType }[] = [
  { label: "All" },
  { label: "Airtime", value: "airtime" },
  { label: "Data", value: "data" },
  { label: "Cable TV", value: "cable" },
  { label: "Electricity", value: "electricity" },
];

const SERVICE_LABELS: Record<BillServiceType, string> = {
  airtime: "Airtime",
  data: "Data",
  cable: "Cable TV",
  electricity: "Electricity",
};

export default async function BillsPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceType?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { serviceType } = params;
  const activeType = (
    SERVICE_FILTERS.some((f) => f.value === serviceType)
      ? serviceType
      : undefined
  ) as BillServiceType | undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const { plans, total, totalPages } = await listBillsPlans({
    serviceType: activeType,
    page,
    limit: 50,
  });

  function filterHref(nextService?: BillServiceType) {
    const q = new URLSearchParams();
    if (nextService) q.set("serviceType", nextService);
    const qs = q.toString();
    return qs ? `/bills/plans?${qs}` : "/bills/plans";
  }

  function buildHref(targetPage: number) {
    const q = new URLSearchParams();
    if (activeType) q.set("serviceType", activeType);
    q.set("page", String(targetPage));
    return `/bills/plans?${q.toString()}`;
  }

  const heading = activeType ? SERVICE_LABELS[activeType] : null;

  return (
    <>
      <PageHeader
        title="Bill Plans"
        description="Members are shown VTpass' live catalogue, so names and prices here are for toggling and reference. A plan switched OFF is hidden from the app; sync to pull newly added plans so they can be toggled too. Cashback % is the share of the purchase amount credited to the member's cashback wallet (0 turns it off)."
        actions={
          <Link
            href="/bills"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
          >
            Catalogue
          </Link>
        }
      />
      <BillsNav active="plans" />

      <div className="p-8 space-y-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {SERVICE_FILTERS.map((f) => {
              const active = (f.value ?? "") === (activeType ?? "");
              return (
                <Link
                  key={f.label}
                  href={filterHref(f.value)}
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
              {heading ? `${heading} plans (${total})` : `All plans (${total})`}
            </h2>
          </div>

          {plans.length === 0 ? (
            <p className="px-6 py-8 text-sm text-ink-soft">
              No plans yet. Synchronize this category from the Catalogue screen.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[880px]">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-6 py-3 font-medium">Service</th>
                    <th className="px-6 py-3 font-medium">Plan</th>
                    <th className="px-6 py-3 font-medium">Bucket</th>
                    <th className="px-6 py-3 font-medium">Amount</th>
                    <th className="px-6 py-3 font-medium">Cashback %</th>
                    <th className="px-6 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((plan) => (
                    <tr key={plan.id} className="border-b border-line last:border-0">
                      <td className="px-6 py-3 capitalize text-ink">
                        {plan.serviceType}
                      </td>
                      <td className="px-6 py-3 font-medium text-ink">{plan.name}</td>
                      <td className="px-6 py-3 text-ink-soft">{plan.bucket}</td>
                      <td className="px-6 py-3 font-mono text-ink-soft">
                        {plan.amount > 0 ? formatCurrency(plan.amount) : "—"}
                      </td>
                      <td className="px-6 py-3">
                        <PlanCashbackInput
                          id={plan.id}
                          cashbackPercent={plan.cashbackPercent}
                        />
                      </td>
                      <td className="px-6 py-3">
                        <PlanActiveToggle id={plan.id} isActive={plan.isActive} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {plans.length > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} buildHref={buildHref} />
        )}

        {activeType && (
          <p className="text-xs text-ink-soft">
            Showing{" "}
            <span className="font-medium">{SERVICE_LABELS[activeType]}</span>{" "}
            plans only.
          </p>
        )}
      </div>
    </>
  );
}
