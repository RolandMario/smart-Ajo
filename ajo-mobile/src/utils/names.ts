/**
 * Small name helpers shared by the redesigned screens.
 *
 * Extracted verbatim from WalletHomeScreen so the cycle screens, the cycle
 * list/detail, and the wallet home all render member names identically.
 */

/** "Ngozi Eze" → "NE"; falls back to "?" for missing/blank names. */
export function initials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (
    parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")
  ).toUpperCase();
}

/** "Chidinma Amara Nnamdi" → "Chidinma N." (the mock's "Chidinma A." style). */
export function displayName(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Ajo member";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** First given name: "Chidinma N." → "Chidinma". Falls back to "Member". */
export function firstName(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[0] : "Member";
}