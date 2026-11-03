/**
 * Nigerian phone-number normalisation.
 *
 * Why this exists: members register with whatever format they typed
 * (`08012345678`, `+2348012345678`, `234 801 234 5678`, …). Paystack, on the
 * other hand, sends a single canonical format on webhooks and expects E.164 on
 * `POST /customer` and `POST /dedicated_account`. Matching a member by a raw
 * string comparison therefore fails silently: a Dedicated Virtual Account
 * transfer would settle at Paystack while the wallet was never credited.
 *
 * Everything that needs to compare phone numbers (webhook reconciliation,
 * customer creation) goes through this module.
 */

const NG_COUNTRY_CODE = '234';
const NG_LOCAL_PREFIX = '0';

/** Digits only — `+234 801-234-5678` → `2348012345678`. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * The 10 significant digits of a Nigerian mobile number, without the country
 * code or the trunk `0` prefix. Returns `null` for anything that isn't a
 * recognisable Nigerian number (non-Nigerian numbers, short codes, typos).
 */
function ngSubscriberDigits(value: string): string | null {
  let digits = digitsOnly(value);

  if (!digits) return null;

  // `+234 (0) 706…` — the trunk 0 is optional after the country code.
  if (
    digits.startsWith(`${NG_COUNTRY_CODE}${NG_LOCAL_PREFIX}`) &&
    digits.length === 14
  ) {
    digits = `${NG_COUNTRY_CODE}${digits.slice(NG_COUNTRY_CODE.length + 1)}`;
  }

  const national =
    digits.startsWith(NG_COUNTRY_CODE) && digits.length === 13
      ? digits.slice(NG_COUNTRY_CODE.length)
      : digits;

  const subscriber =
    national.startsWith(NG_LOCAL_PREFIX) && national.length === 11
      ? national.slice(1)
      : national;

  return /^[789]\d{9}$/.test(subscriber) ? subscriber : null;
}

/**
 * Normalises a phone number to E.164 (`+2348012345678`), which is what
 * Paystack expects on customer and Dedicated Virtual Account creation.
 *
 * Numbers that can't be parsed as Nigerian are returned trimmed and
 * unchanged, so a non-Nigerian number is never mangled.
 */
export function toE164Nigeria(value?: string | null): string | undefined {
  const raw = (value ?? '').trim();

  if (!raw) return undefined;

  const subscriber = ngSubscriberDigits(raw);

  return subscriber ? `+${NG_COUNTRY_CODE}${subscriber}` : raw;
}

/**
 * Every format the same Nigerian number may arrive in, for queries:
 * `+2348012345678`, `2348012345678`, `08012345678`, `8012345678`.
 * Unparseable numbers yield a single variant (the trimmed input).
 */
export function ngPhoneVariants(value?: string | null): string[] {
  const raw = (value ?? '').trim();

  if (!raw) return [];

  const subscriber = ngSubscriberDigits(raw);

  if (!subscriber) return [raw];

  return Array.from(
    new Set([
      `+${NG_COUNTRY_CODE}${subscriber}`,
      `${NG_COUNTRY_CODE}${subscriber}`,
      `${NG_LOCAL_PREFIX}${subscriber}`,
      subscriber,
      raw,
    ]),
  );
}

/** `true` when both inputs describe the same Nigerian phone number. */
export function isSamePhone(a?: string | null, b?: string | null): boolean {
  const variants = new Set(ngPhoneVariants(a));

  return ngPhoneVariants(b).some((variant) => variants.has(variant));
}
