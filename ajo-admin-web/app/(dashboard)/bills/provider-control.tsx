"use client";

import { useActionState, useTransition, useState } from "react";
import {
  setBillProviderAction,
  syncBillsPlansAction,
} from "@/lib/data/bills-actions";
import { Button } from "@/components/ui/button";
import type { BillProviderConfigItem, BillServiceType } from "@/lib/types/api";
import { formatDate } from "@/lib/format";

const SERVICE_LABELS: Record<BillServiceType, string> = {
  airtime: "Airtime",
  data: "Data",
  cable: "Cable TV",
  electricity: "Electricity",
};

export function ProviderControl({ config }: { config: BillProviderConfigItem }) {
  const { serviceType } = config;
  const [state, formAction] = useActionState(setBillProviderAction, {});
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
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="serviceType" value={serviceType} />
          <select
            name="provider"
            defaultValue={config.activeProvider}
            className="rounded-md border border-line bg-canvas px-3 py-2 text-sm text-ink"
          >
            <option value="vtpass">VTPass</option>
            <option value="gladtidings">Gladtidings</option>
          </select>
          <Button type="submit" variant="secondary" className="text-xs">
            Set active
          </Button>
        </form>
        <Button
          variant="ghost"
          onClick={handleSync}
          disabled={syncing}
          className="text-xs"
        >
          {syncing ? "Syncing…" : "Synchronize plans"}
        </Button>

        {(state.error || error) && (
          <p className="text-xs text-danger">{state.error ?? error}</p>
        )}
        {state.success && !state.error && (
          <p className="text-xs text-success">Provider updated.</p>
        )}
        {syncResult && !error && (
          <p className="text-xs text-ink-soft">{syncResult}</p>
        )}
      </div>
    </div>
  );
}