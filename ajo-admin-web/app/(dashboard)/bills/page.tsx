import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getBillsProviders } from "@/lib/data/bills";
import { ProviderControl } from "./provider-control";
import { BillsNav } from "./bills-nav";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const providers = await getBillsProviders();

  return (
    <>
      <PageHeader
        title="Bill Services"
        description="Choose which VTU provider handles each service, then synchronize its price list. Turn individual plans on or off on the Plans screen."
        actions={
          <Link
            href="/bills/plans"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
          >
            Manage plans
          </Link>
        }
      />
      <BillsNav active="providers" />

      <div className="p-8 space-y-4 max-w-4xl">
        <Card>
          <div className="px-6 py-4 border-b border-line">
            <h2 className="font-display text-lg font-semibold text-ink">
              Provider routing
            </h2>
            <p className="text-sm text-ink-soft mt-1">
              VTPass is the default for every category until you switch it. Set
              a category to Gladtidings, then Synchronize to pull its plans.
            </p>
          </div>

          <div className="divide-y divide-line">
            {providers.map((config) => (
              <ProviderControl key={config.serviceType} config={config} />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}