/**
 * Format a naira amount for display.
 */
export function formatNaira(amount: number): string {
  return `₦${amount.toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

/**
 * Format a donation amount: fixed pools show the naira amount, free-will
 * pools read "Any amount".
 */
export function formatDonationAmount(
  amountType: string,
  amount?: number,
): string {
  if (amountType === "free_will") return "Any amount";
  return formatNaira(amount ?? 0);
}

/** "One-time" / "Daily" / ... — the cadence chip on a pool card. */
export function formatDonationCadence(
  schedule: string,
  frequency?: string | null,
): string {
  if (schedule !== "interval" || !frequency) return "One-time";
  const labels: Record<string, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
  };
  return labels[frequency] ?? frequency;
}

/**
 * Human label for a donation period key: `once` -> "One-time",
 * `2026-W43` -> "Week 43, 2026", `2026-10` -> "October 2026",
 * `2026-10-25` -> "25 Oct 2026", `2026` -> "2026".
 */
export function formatDonationPeriod(period: string): string {
  if (period === "once") return "One-time";

  const week = /^(\d{4})-W(\d{2})$/.exec(period);
  if (week) return `Week ${Number(week[2])}, ${week[1]}`;

  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(period);
  if (day) return formatDate(`${period}T12:00:00`);

  const month = /^(\d{4})-(\d{2})$/.exec(period);
  if (month) {
    return new Date(`${period}-01T12:00:00`).toLocaleDateString("en-NG", {
      month: "long",
      year: "numeric",
    });
  }

  const year = /^\d{4}$/.test(period);
  if (year) return period;

  return period;
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
 * "2026-09-28T…" → "28 Sept" — the compact due-date chip used on the cycle
 * ring cards and cycle list rows.
 */
export function formatDayMonth(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
  });
}

/**
 * "2026-09-28T…" → "Sunday, 28 Sept" — the full due-date read-out on the
 * cycle round/detail cards.
 */
export function formatWeekdayDayMonth(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-NG", {
    weekday: "long",
    day: "numeric",
    month: "short",
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
