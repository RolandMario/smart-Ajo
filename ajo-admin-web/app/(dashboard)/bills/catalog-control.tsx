"use client";

import { useTransition, useState } from "react";
import { syncBillsPlansAction } from "@/lib/data/bills-actions";
import { Button } from "@/components/ui/button";
import type { BillCatalogStatus, BillServiceType } from "@/lib/types/api";
import { formatDate } from "@/lib/format";

const SERVICE_LABELS: Record<BillServiceType, string> = {
  airtime: "Airtime",
  data: "Data",
  cable: "Cable TV",
  electricity: "Electricity",
};

/** `lastSyncStatus` is 'never', 'success' or the text of the last failure. */
function syncStatusLabel(status: string): string {
  if (status === "never") return "Never synced";
  if (status === "success") return "Last sync succeeded";
  return status;
}

/**
 * One row of the Bills catalogue screen: how many VTpass plans exist for a
 * category and a button to pull the latest list. There is no provider to pick —
 * VTpass is the only bills provider.
 */
export function CatalogControl({ config }: { config: BillCatalogStatus }) {
  const { serviceType } = config;
  const [syncing, startSyncing] = useTransition();
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSync() {
    setSyncResult(null);
    setError(null);
    startSyncing(async () => {
      const res = await syncBillsPlansAction(serviceType);
      if (res.error) {
        setError(res.error);
      } else {
        setSyncResult(
          `Synced ${res.total} ${SERVICE_LABELS[serviceType].toLowerCase()} plans (${res.created} new, ${res.updated} updated, ${res.removed} removed).`,
        );
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-6 p-6">
      <div className="min-w-0">
        <h3 className="font-display text-base font-semibold text-ink">
          {SERVICE_LABELS[serviceType]}
        </h3>
        <p className="text-xs text-ink-soft mt-1">
          {config.planTotal} plans · {config.planActive} live in the app
          {config.lastSyncedAt
            ? ` · last synced ${formatDate(config.lastSyncedAt)}`
            : " · not synced yet"}
        </p>
        <p className="text-xs mt-1 text-ink-soft">
          {syncStatusLabel(config.lastSyncStatus)}
        </p>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <Button
          variant="ghost"
          onClick={handleSync}
          disabled={syncing}
          className="text-xs"
        >
          {syncing ? "Syncing…" : "Synchronize plans"}
        </Button>

        {error && <p className="text-xs text-danger">{error}</p>}
        {syncResult && !error && (
          <p className="text-xs text-ink-soft">{syncResult}</p>
        )}
      </div>
    </div>
  );
}
