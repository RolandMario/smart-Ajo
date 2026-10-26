import { randomInt } from 'crypto';

/**
 * Human-friendly, shareable "Group ID" used by potential members to find
 * and join a group. Deliberately NOT the Mongo `_id` — a short, easy to
 * read/type code is what an admin can copy into a WhatsApp message.
 *
 * The alphabet omits visually ambiguous characters (0/O, 1/I/L) so the
 * code survives being hand-typed or read aloud over the phone.
 */
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const JOIN_CODE_LENGTH = 8;

export function generateJoinCode(): string {
  const chars = new Array<string>(JOIN_CODE_LENGTH);
  for (let i = 0; i < JOIN_CODE_LENGTH; i++) {
    chars[i] = JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  }
  return chars.join('');
}

/**
 * Normalize a user-supplied Group ID for lookup: trim whitespace, fold to
 * uppercase and strip anything that isn't a letter/digit (so "ajo-7K3QP2" or
 * " 7k3qp2 " still resolves). `joinCode` is stored uppercase, so the stored
 * value and the normalized input compare directly.
 */
export function normalizeJoinCode(input: string): string {
  return input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}
