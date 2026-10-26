import {
  DonationFrequency,
  DonationSchedule,
} from '../../common/enums/donation.enum';
import { DONATION_ONE_TIME_PERIOD } from '../donation.constants';

/** Pads a number to two digits (months, days, ISO week numbers). */
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * ISO-8601 week key (`2026-W43`) for the week containing `at`.
 *
 * Weeks start on Monday and belong to the year that owns their Thursday, so
 * 1 Jan 2027 (a Friday) is `2026-W53` — the same convention Postgres'
 * `to_char(..., 'IYYY-"W"IW')` uses. The calendar day is normalised to UTC
 * first so a DST transition cannot shift the weekday.
 */
function isoWeekKey(at: Date): string {
  const d = new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate()));
  const dayNumber = d.getUTCDay() || 7; // Mon = 1 ... Sun = 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNumber); // Thursday of this week
  const isoYear = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(isoYear, 0, 1));
  const week = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${isoYear}-W${pad(week)}`;
}

/**
 * The period a donation made at `at` counts against.
 *
 * One-time pools use the constant `once` key so that the unique
 * {group, user, period} index caps each member at a single donation, no
 * matter when they give. Interval pools get a calendar key:
 *
 *   daily   -> `2026-10-25`
 *   weekly  -> `2026-W43` (ISO week)
 *   monthly -> `2026-10`
 *   yearly  -> `2026`
 *
 * The key is stored on the Donation and embedded in its wallet reference, so
 * a retried request can never charge the same period twice.
 */
export function currentPeriodKey(
  schedule: DonationSchedule,
  frequency: DonationFrequency | undefined,
  at: Date = new Date(),
): string {
  if (schedule !== DonationSchedule.INTERVAL || !frequency) {
    return DONATION_ONE_TIME_PERIOD;
  }

  switch (frequency) {
    case DonationFrequency.DAILY:
      return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
    case DonationFrequency.WEEKLY:
      return isoWeekKey(at);
    case DonationFrequency.MONTHLY:
      return `${at.getFullYear()}-${pad(at.getMonth() + 1)}`;
    case DonationFrequency.YEARLY:
      return String(at.getFullYear());
  }
}

/**
 * When the current period ends and the donor's next donation becomes
 * possible — midnight of the next day / Monday / month / year, in server
 * local time. Purely informational: it drives the "next donation opens on…"
 * label on the pool detail. Returns `null` for one-time pools, which never
 * reopen.
 */
export function nextPeriodStart(
  frequency: DonationFrequency | undefined,
  at: Date = new Date(),
): Date | null {
  if (!frequency) return null;

  switch (frequency) {
    case DonationFrequency.DAILY:
      return new Date(at.getFullYear(), at.getMonth(), at.getDate() + 1);
    case DonationFrequency.WEEKLY: {
      const dayNumber = at.getDay() || 7; // Mon = 1 ... Sun = 7
      return new Date(
        at.getFullYear(),
        at.getMonth(),
        at.getDate() + (8 - dayNumber),
      );
    }
    case DonationFrequency.MONTHLY:
      return new Date(at.getFullYear(), at.getMonth() + 1, 1);
    case DonationFrequency.YEARLY:
      return new Date(at.getFullYear() + 1, 0, 1);
  }
}

/** Human label for the donation window, e.g. "this week" / "one-time". */
export function periodLabel(
  schedule: DonationSchedule,
  frequency: DonationFrequency | undefined,
): string {
  if (schedule !== DonationSchedule.INTERVAL || !frequency) return 'one-time';

  switch (frequency) {
    case DonationFrequency.DAILY:
      return 'today';
    case DonationFrequency.WEEKLY:
      return 'this week';
    case DonationFrequency.MONTHLY:
      return 'this month';
    case DonationFrequency.YEARLY:
      return 'this year';
  }
}

/** Short cadence adverb used in notifications ("donate ₦500 weekly"). */
export function describeSchedule(
  schedule: DonationSchedule,
  frequency: DonationFrequency | undefined,
): string {
  if (schedule !== DonationSchedule.INTERVAL || !frequency) {
    return 'one-time';
  }

  switch (frequency) {
    case DonationFrequency.DAILY:
      return 'daily';
    case DonationFrequency.WEEKLY:
      return 'weekly';
    case DonationFrequency.MONTHLY:
      return 'monthly';
    case DonationFrequency.YEARLY:
      return 'yearly';
  }
}
