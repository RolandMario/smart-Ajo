import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getBillsCatalog } from "@/lib/data/bills";
import { CatalogControl } from "./catalog-control";
import { BillsNav } from "./bills-nav";

export const dynamic = "force-dynamic";

export default async function BillsPage() {
  const catalog = await getBillsCatalog();

  return (
    <>
      <PageHeader
        title="Bill Services"
        description="Airtime, data, cable TV and electricity are sold through VTpass. Synchronize a category to pull its latest price list, then turn individual plans on or off on the Plans screen."
        actions={
          <Link
            href="/bills/plans"
            className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/90"
          >
            Manage plans
          </Link>
        }
      />
      <BillsNav active="catalog" />

      <div className="p-8 space-y-4">
        <Card>
          <div className="px-6 py-4 border-b border-line">
            <h2 className="font-display text-lg font-semibold text-ink">
              Catalogue
            </h2>
            <p className="text-sm text-ink-soft mt-1">
              VTPass is the only bills provider. Synchronize a category to import
              its plans (and current prices) into the app. Plans that are OFF are
              hidden from members, and a category with no live plans disappears
              from the member app entirely.
            </p>
          </div>

          <div className="divide-y divide-line">
            {catalog.map((config) => (
              <CatalogControl key={config.serviceType} config={config} />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
