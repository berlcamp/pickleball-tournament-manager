/**
 * Short codes for public tournament links.
 *
 * A tournament is reachable at `/{short_code}` — right off the domain root, so
 * a poster can read "sortbrite.com/ab3kd". Because that route sits at the top
 * level it shares a namespace with every real page, hence `RESERVED_CODES`.
 */

/** Lowercase alphanumerics minus the characters people misread (0/o, 1/l/i). */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const SHORT_CODE_LENGTH = 5;
export const SHORT_CODE_MIN = 3;
export const SHORT_CODE_MAX = 32;

/**
 * Codes an organizer may not claim, because `/{code}` would otherwise shadow
 * (or be shadowed by) a real route. Static segments win over the dynamic one
 * in Next.js, so a tournament on "dashboard" would simply be unreachable.
 *
 * Keep in sync with the top-level folders in `src/app/`.
 */
export const RESERVED_CODES = new Set([
  // real routes today
  "api",
  "auth",
  "dashboard",
  "login",
  "monitor",
  "qr",
  "r",
  "raffle-draw",
  "tournament",
  // framework and well-known files
  "_next",
  "assets",
  "favicon.ico",
  "images",
  "manifest.json",
  "opensearch.xml",
  "public",
  "robots.txt",
  "sitemap.xml",
  "static",
  "www",
  // plausible future pages — cheap to reserve now, painful to reclaim later
  "about",
  "account",
  "admin",
  "blog",
  "contact",
  "docs",
  "help",
  "home",
  "logout",
  "new",
  "pricing",
  "privacy",
  "register",
  "settings",
  "signin",
  "signout",
  "signup",
  "support",
  "terms",
  "tournaments",
]);

export function generateShortCode(length = SHORT_CODE_LENGTH): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  // 2^32 is divisible by 31? No — reject-and-retry would be needed for perfect
  // uniformity, but the bias here is ~1e-9 and the codes are not secrets.
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** Lowercase and trim whatever the organizer typed. */
export function normalizeShortCode(input: string): string {
  return input.trim().toLowerCase();
}

export function isReservedCode(code: string): boolean {
  return RESERVED_CODES.has(normalizeShortCode(code));
}

const SHAPE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Null when valid, otherwise the reason to show the organizer. */
export function shortCodeProblem(code: string): string | null {
  const value = normalizeShortCode(code);
  if (value.length < SHORT_CODE_MIN || value.length > SHORT_CODE_MAX) {
    return `Use between ${SHORT_CODE_MIN} and ${SHORT_CODE_MAX} characters.`;
  }
  if (!SHAPE.test(value)) {
    return "Use lowercase letters, numbers and hyphens only (no hyphen at the start or end).";
  }
  if (isReservedCode(value)) {
    return "That word is reserved by the app. Please choose another.";
  }
  return null;
}
