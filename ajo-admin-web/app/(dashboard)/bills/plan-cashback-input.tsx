"use client";

import { useState } from "react";
import { setBillPlanCashbackAction } from "@/lib/data/bills-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Inline editor for a plan's cashback rate — the "Cashback %" column on the
 * Bill Plans table. The rate is a percentage of the purchase amount paid back
 * to the member (`0.5` = ₦0.50 back on a ₦100 bundle), and `0` turns cashback
 * off for that plan. Saved per row, so an admin can price one bundle without
 * touching the rest of the catalogue.
 */
export function PlanCashbackInput({
  id,
  cashbackPercent,
}: {
  id: string;
  cashbackPercent: number;
}) {
  const [value, setValue] = useState(String(cashbackPercent ?? 0));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Last rate the server confirmed — drives the "Saved" confirmation. */
  const [savedValue, setSavedValue] = useState<number | null>(null);

  const parsed = Number.parseFloat(value);
  const invalid = Number.isNaN(parsed) || parsed < 0 || parsed > 100;
  const dirty = parsed !== (cashbackPercent ?? 0);
  const saved = savedValue !== null && parsed === savedValue;

  async function save() {
    if (invalid) {
      setError("Enter a percentage between 0 and 100.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await setBillPlanCashbackAction(id, parsed);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSavedValue(parsed);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          aria-label="Cashback percentage"
          type="number"
          min={0}
          max={100}
          step="0.01"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          className="w-20 px-2 py-1 text-right"
        />
        <span className="text-xs text-ink-soft">%</span>
        <Button
          type="submit"
          variant="secondary"
          disabled={saving || invalid || !dirty}
          className="text-xs px-2.5 py-1"
        >
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
      {saved && !error && <span className="text-xs text-success">Saved</span>}
    </form>
  );
}
