import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import { listBillsPlans } from "@/lib/data/bills";
import { formatCurrency } from "@/lib/format";
import type {
  BillProviderKey,
  BillServiceType,
} from "@/lib/types/api";
import { PlanActiveToggle } from "../plan-active-toggle";
import { BillsNav } from "../bills-nav";

export const dynamic = "force-dynamic";

const SERVICE_FILTERS: { label: string; value?: BillServiceType }[] = [
  { label: "All" },
  { label: "Airtime", value: "airtime" },
  { label: "Data", value: "data" },
  { label: "Cable TV", value: "cable" },
  { label: "Electricity", value: "electricity" },
];

const PROVIDER_FILTERS: { label: string; value?: BillProviderKey }[] = [
  { label: "All", value: undefined },
  { label: "VTPass", value: "vtpass" },
  { label: "Gladtidings", value: "gladtidings" },
];

const SERVICE_LABELS: Record<BillServiceType, string> = {
  airtime: "Airtime",
  data: "Data",
  cable: "Cable TV",
  electricity: "Electricity",
};

const PROVIDER_LABELS: Record<BillProviderKey, string> = {
  vtpass: "VTPass",
  gladtidings: "Gladtidings",
};

export default async function BillsPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ serviceType?: string; provider?: string; page?: string }>;
}) {
  const params = await searchParams;
  const { serviceType, provider } = params;
  const activeType = (
    SERVICE_FILTERS.some((f) => f.value === serviceType)
      ? serviceType
      : undefined
  ) as BillServiceType | undefined;
  const activeProvider = (
    PROVIDER_FILTERS.some((f) => f.value === provider)
      ? provider
      : undefined
  ) as BillProviderKey | undefined;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const { plans, total, totalPages } = await listBillsPlans({
    serviceType: activeType,
    provider: activeProvider,
    page,
    limit: 50,
  });

  function filterHref(nextService?: BillServiceType, nextProvider?: BillProviderKey) {
    const q = new URLSearchParams();
    if (nextService) q.set("serviceType", nextService);
    if (nextProvider) q.set("provider", nextProvider);
    const qs = q.toString();
    return qs ? `/bills/plans?${qs}` : "/bills/plans";
  }

  function buildHref(targetPage: number) {
    const q = new URLSearchParams();
    if (activeType) q.set("serviceType", activeType);
    if (activeProvider) q.set("provider", activeProvider);
    q.set("page", String(targetPage));
    return `/bills/plans?${q.toString()}`;
  }

  const heading = [
    activeType ? SERVICE_LABELS[activeType] : null,
    activeProvider ? `${PROVIDER_LABELS[activeProvider]} plans` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title="Bill Plans"
        description="Every plan the member app can offer. Plans that are ON appear in the app; OFF plans are hidden. A sync pulls the active provider's latest list."
        actions={
          <Link
            href="/bills"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
          >
            Providers
          </Link>
        }
      />
      <BillsNav active="plans" />

      <div className="p-8 space-y-6 max-w-5xl">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {SERVICE_FILTERS.map((f) => {
              const active = (f.value ?? "") === (activeType ?? "");
              return (
                <Link
                  key={f.label}
                  href={filterHref(f.value, activeProvider)}
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
            {PROVIDER_FILTERS.map((f) => {
              const active = (f.value ?? "") === (activeProvider ?? "");
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
              {heading ? `${heading} plans (${total})` : `All plans (${total})`}
            </h2>
          </div>

          {plans.length === 0 ? (
            <p className="px-6 py-8 text-sm text-ink-soft">
              No plans yet. Synchronize this category from the Providers screen.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-6 py-3 font-medium">Service</th>
                  <th className="px-6 py-3 font-medium">Plan</th>
                  <th className="px-6 py-3 font-medium">Bucket</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Provider</th>
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
                    <td className="px-6 py-3 text-ink-soft">{plan.provider}</td>
                    <td className="px-6 py-3">
                      <PlanActiveToggle id={plan.id} isActive={plan.isActive} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {plans.length > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} buildHref={buildHref} />
        )}

        {(activeType || activeProvider) && (
          <p className="text-xs text-ink-soft">
            Showing{" "}
            <span className="font-medium">
              {[
                activeType ? SERVICE_LABELS[activeType] : null,
                activeProvider ? PROVIDER_LABELS[activeProvider] : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>{" "}
            plans only.
          </p>
        )}
      </div>
    </>
  );
}