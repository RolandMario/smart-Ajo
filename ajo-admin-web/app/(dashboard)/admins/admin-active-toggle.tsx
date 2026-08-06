"use client";

import { useState, useTransition } from "react";
import { setAdminActiveAction } from "@/lib/data/admin-actions";
import { Button } from "@/components/ui/button";

export function AdminActiveToggle({
  adminId,
  isActive,
  isSelf,
}: {
  adminId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (isSelf) {
    return <span className="text-xs text-ink-soft">This is you</span>;
  }

  function handleClick() {
    const nextState = !isActive;
    const confirmMessage = nextState
      ? "Reactivate this admin? They will be able to sign in again immediately."
      : "Deactivate this admin? They will be signed out immediately, even with an active session.";

    if (!window.confirm(confirmMessage)) return;

    setError(null);
    startTransition(async () => {
      try {
        await setAdminActiveAction(adminId, nextState);
      } catch {
        setError("Couldn't update this admin. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        variant={isActive ? "danger" : "secondary"}
        onClick={handleClick}
        disabled={isPending}
        className="text-xs px-2.5 py-1"
      >
        {isPending ? "Updating…" : isActive ? "Deactivate" : "Reactivate"}
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
