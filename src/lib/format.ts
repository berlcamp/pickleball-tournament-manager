export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

/**
 * Parse a value that may be a plain calendar day ("2026-07-03").
 *
 * `new Date("2026-07-03")` is midnight **UTC**, which formats as the previous
 * day for every viewer west of Greenwich — and the portal renders these dates
 * in the visitor's browser. A calendar day carries no time zone, so it is built
 * as local midnight and stays the day the organiser typed.
 */
function parseCalendarDate(value: string): Date {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return ymd
    ? new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]))
    : new Date(value);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "TBD";
  return parseCalendarDate(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * The portal's date line. Each category carries its own play date, so when the
 * organiser hasn't set a tournament-wide start date the label is derived from
 * the categories: one day when they share it, a span when they don't.
 */
export function formatEventDates(
  startDate: string | null | undefined,
  categoryDates: (string | null | undefined)[] = [],
): string {
  if (startDate) return formatDate(startDate);
  const sorted = categoryDates.filter((d): d is string => Boolean(d)).sort();
  if (sorted.length === 0) return formatDate(null);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return first === last
    ? formatDate(first)
    : `${formatDate(first)} – ${formatDate(last)}`;
}

/** "08:00" + minutes -> "08:15" */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor((total % (24 * 60)) / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/** ISO "YYYY-MM-DD" + whole days -> ISO "YYYY-MM-DD" (UTC math, no tz drift). */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Whole days from one ISO "YYYY-MM-DD" to another (UTC math, no tz drift). */
export function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const ms = Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd);
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(time: string | null | undefined): string {
  if (!time) return "—";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

export function initials(name: string): string {
  return name
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Peso amounts for registration fees. Whole pesos render without decimals. */
export function formatCurrency(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** "Sep 1, 2026, 11:59 PM" for registration deadlines. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Compact deadline for tight mobile chips: "Sep 1, 11:59 PM". The year is
 * included only when it differs from the current one, since a registration
 * deadline is almost always within the same year.
 */
export function formatDeadline(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    hour: "numeric",
    minute: "2-digit",
  });
}
