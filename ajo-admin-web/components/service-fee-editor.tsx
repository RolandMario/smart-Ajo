'use client';

import { useState } from 'react';

interface ServiceFeeEditorProps {
  groupId: string;
  currentFee: number;
  onUpdate: (groupId: string, fee: number) => Promise<void>;
}

export function ServiceFeeEditor({ groupId, currentFee, onUpdate }: ServiceFeeEditorProps) {
  const [fee, setFee] = useState((currentFee ?? 0).toString());
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const newFee = parseInt(fee, 10);
    if (isNaN(newFee) || newFee < 0) {
      return;
    }
    
    setIsUpdating(true);
    try {
      await onUpdate(groupId, newFee);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="number"
        value={fee}
        onChange={(e) => setFee(e.target.value)}
        min="0"
        className="w-24 rounded border border-line px-2 py-1 text-sm font-mono"
      />
      <button
        type="submit"
        disabled={isUpdating}
        className="rounded bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
      >
        {isUpdating ? 'Updating...' : 'Update'}
      </button>
    </form>
  );
}