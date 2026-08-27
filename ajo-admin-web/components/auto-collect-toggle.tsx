'use client';

import { useState } from 'react';

interface AutoCollectToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
}

/**
 * Interactive auto-collect switch for a group's settings. Lets a platform
 * admin override the group admin's auto-collect setting. When ON, due
 * contributions (and the resulting payout) are collected automatically by
 * the scheduler; when OFF, the group admin triggers them manually.
 */
export function AutoCollectToggle({ enabled, onToggle }: AutoCollectToggleProps) {
  const [isOn, setIsOn] = useState(enabled);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const next = !isOn;
    setIsPending(true);
    setError(null);
    try {
      await onToggle(next);
      setIsOn(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update auto-collect');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        aria-label="Toggle auto-collect"
        disabled={isPending}
        onClick={handleToggle}
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 ${
          isOn ? 'bg-success' : 'bg-line'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
            isOn ? 'translate-x-[18px]' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className="ml-2 text-sm font-medium text-ink">{isOn ? 'On' : 'Off'}</span>
      <p className="mt-1 text-xs text-ink-soft">
        {isOn
          ? 'Contributions & payout are collected automatically.'
          : 'Group admin can initiate contributions & withdrawal manually.'}
      </p>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}