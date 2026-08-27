/**
 * Format a naira amount for display.
 */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format a date string to a readable format.
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format a date string to a readable datetime.
 */
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Pluralize a word based on count.
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/**
 * Format a savings-plan duration (unit + value) for display, e.g.
 * "20 days", "2 months", "1 year".
 */
export function formatDuration(unit: string, value: number): string {
  if (!Number.isFinite(value) || value < 1) return "";
  const singular: Record<string, string> = {
    days: "day",
    months: "month",
    years: "year",
  };
  const word = singular[unit] ?? unit;
  return `${value} ${value === 1 ? word : `${word}s`}`;
}

/**
 * Get a human-readable status label.
 */
export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    open_for_invites: "Open for invites",
    order_locked: "Order locked",
    active: "Active",
    completed: "Completed",
    terminated: "Terminated",
    pending: "Pending",
    accepted: "Accepted",
    declined: "Declined",
    open: "Open",
    paid: "Paid",
    defaulted: "Defaulted",
    collected: "Collected",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}
