/**
 * ajo-server requires E.164 (+2348012345678) — see
 * common/constants/regex.ts (`/^\+[1-9]\d{7,14}$/`). Nigerian users
 * naturally type a local-format number (08012345678 or 8012345678), so
 * this normalizes common input shapes to E.164 before they ever hit the
 * API, rather than rejecting them and making the user figure out the
 * country code themselves.
 */
export function toE164Nigeria(rawInput: string): string {
  const digitsOnly = rawInput.replace(/[^\d+]/g, "");

  if (digitsOnly.startsWith("+234")) {
    return digitsOnly;
  }

  if (digitsOnly.startsWith("234")) {
    return `+${digitsOnly}`;
  }

  // Local format: leading 0 + 10 digits (e.g. 08012345678) -> drop the 0.
  if (digitsOnly.startsWith("0") && digitsOnly.length === 11) {
    return `+234${digitsOnly.slice(1)}`;
  }

  // Bare 10-digit local number without the leading 0 (e.g. 8012345678).
  if (digitsOnly.length === 10) {
    return `+234${digitsOnly}`;
  }

  // Fall through unchanged — let the backend's validator be the final
  // word on anything that doesn't match a recognized shape (e.g. a
  // non-Nigerian number a user pastes in deliberately).
  return digitsOnly.startsWith("+") ? digitsOnly : `+${digitsOnly}`;
}

export function formatPhoneForDisplay(e164: string): string {
  // +2348012345678 -> 0801 234 5678
  const match = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (!match) return e164;
  return `0${match[1]} ${match[2]} ${match[3]}`;
}

/**
 * Convert an E.164 Nigerian number (+2348012345678) into the local format
 * the bill-purchase screens use (08012345678, matching their 11-character
 * phone fields). Non-Nigerian or unrecognized numbers pass through unchanged
 * so the caller's own validation is the final word.
 */
export function e164ToLocalNigeria(e164: string): string {
  const match = /^\+234(\d{10})$/.exec(e164);
  return match ? `0${match[1]}` : e164;
}

/** Format a local Nigerian number for display: 08012345678 -> 0801 234 5678 */
export function formatLocalForDisplay(local: string): string {
  const match = /^0(\d{3})(\d{3})(\d{4})$/.exec(local);
  if (!match) return local;
  return `0${match[1]} ${match[2]} ${match[3]}`;
}
