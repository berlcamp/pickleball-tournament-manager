/**
 * Reference codes for public registrations.
 *
 * The code is the registrant's only credential — it doubles as the status-page
 * URL (`/r/<code>`) — so it has to be both quotable over the phone and
 * impossible to enumerate. `PKL-XXXX-XXXX` over a 32-symbol alphabet gives
 * 32^8 ≈ 1.1e12 combinations while staying short enough to read aloud.
 */

/** Digits and letters with the ambiguous ones (0/O, 1/I/L) removed. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const BODY_LENGTH = 8;

export function generateReferenceCode(): string {
  const bytes = new Uint32Array(BODY_LENGTH);
  crypto.getRandomValues(bytes);
  // Rejection-free mapping is unnecessary here: 2^32 % 32 === 0, so a plain
  // modulo over the full u32 range stays perfectly uniform.
  const body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
  return `PKL-${body.slice(0, 4)}-${body.slice(4)}`;
}

/**
 * Accept whatever the registrant pastes or types — lowercase, missing dashes,
 * a full URL, stray spaces — and return the canonical `PKL-XXXX-XXXX` form.
 * Returns null when the input cannot be a reference code.
 */
export function normalizeReferenceCode(input: string): string | null {
  const raw = input.trim().toUpperCase();
  // Tolerate someone pasting the whole status URL.
  const tail = raw.split(/[/?#]/).filter(Boolean).pop() ?? raw;
  let body = tail.replace(/[^A-Z0-9]/g, "");
  if (body.startsWith("PKL")) body = body.slice(3);
  if (body.length !== BODY_LENGTH) return null;

  // The alphabet deliberately omits 0/O/1/I/L, so anything outside it is a
  // typo we cannot safely guess at — better to say "not found" than to look up
  // some other team's registration.
  if ([...body].some((ch) => !ALPHABET.includes(ch))) return null;

  return `PKL-${body.slice(0, 4)}-${body.slice(4)}`;
}

/**
 * Team display name derived from player surnames — "Santos / Cruz" for
 * doubles, "Juan Santos" for singles. Admins can rename the participant
 * afterwards; this just keeps brackets consistent without asking registrants
 * to invent a name.
 */
export function deriveTeamName(playerNames: string[]): string {
  const names = playerNames.map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return "Unnamed team";
  if (names.length === 1) return names[0];
  return names.map(surname).join(" / ");
}

function surname(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : parts[parts.length - 1];
}
