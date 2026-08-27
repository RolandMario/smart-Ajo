"use client";

import { useState, useTransition } from "react";
import { setBillPlanActiveAction } from "@/lib/data/bills-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function PlanActiveToggle({
  id,
  isActive,
}: {
  id: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    const next = !isActive;
    setError(null);
    startTransition(async () => {
      const res = await setBillPlanActiveAction(id, next);
      if (res.error) setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {isActive ? <Badge tone="success">On</Badge> : <Badge tone="danger">Off</Badge>}
      <Button
        variant="secondary"
        onClick={toggle}
        disabled={isPending}
        className="text-xs px-2.5 py-1"
      >
        {isPending ? "Updating…" : isActive ? "Turn off" : "Turn on"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}