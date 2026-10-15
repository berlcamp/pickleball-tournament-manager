import { CalendarDays, MapPin } from "lucide-react";
import { formatDate, formatEventDates } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, Tournament } from "@/types";

/**
 * Hero for the public portal: the tournament's name, date and venue on a
 * court-green header drawn as a pickleball court, then the day each category
 * is played.
 *
 * Categories run on their own days, so the headline date is derived from them
 * when the organiser hasn't set a tournament-wide start date — a single day
 * when they all share one, a range when they don't.
 *
 * The uploaded banner is deliberately not shown here: a designed poster
 * repeats the name and date the header already gives, and pushed the tabs
 * below the fold on a phone. It is still the link preview (`og:image`).
 */
export function TournamentBanner({
  tournament,
  categories = [],
  compact = false,
}: {
  tournament: Tournament;
  categories?: Category[];
  /** Status page: smaller poster, no description or category days. */
  compact?: boolean;
}) {
  // Only dated categories are published; an undated one simply isn't announced.
  const dated = categories
    .filter((c) => c.event_date)
    .sort((a, b) => (a.event_date! < b.event_date! ? -1 : 1));
  const headlineDate = formatEventDates(
    tournament.start_date,
    dated.map((c) => c.event_date),
  );
  const live = categories.some(
    (c) => c.status === "group_stage" || c.status === "final_stage",
  );
  const finished =
    !live &&
    categories.length > 0 &&
    categories.every((c) => c.status === "completed");

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-court text-court-foreground shadow-card">
      <div className="relative isolate">
        <CourtBackdrop />
        <div className={cn("p-6 sm:px-10 sm:py-9", compact && "sm:p-6")}>
          {(live || finished) && (
            <div className="mb-2.5">
              {live ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ball px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-[0.12em] text-ball-foreground">
                  <span className="relative flex size-2" aria-hidden>
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-ball-foreground/50" />
                    <span className="relative inline-flex size-2 rounded-full bg-ball-foreground" />
                  </span>
                  Live now
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-court-foreground/12 px-2.5 py-1 font-heading text-xs font-bold uppercase tracking-[0.12em] text-court-foreground">
                  Final results
                </span>
              )}
            </div>
          )}

          <h1
            className={cn(
              "text-balance font-bold uppercase",
              compact ? "text-2xl sm:text-3xl" : "text-[2rem] sm:text-5xl",
              "leading-[0.95]",
            )}
          >
            {tournament.name}
          </h1>

          <div className="mt-3 flex flex-col gap-1.5 text-sm text-court-foreground/85 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:text-base">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-4 shrink-0 text-ball" aria-hidden />
              {headlineDate}
            </span>
            {tournament.location && (
              <span className="flex items-start gap-2 sm:items-center">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-ball sm:mt-0"
                  aria-hidden
                />
                {tournament.location}
              </span>
            )}
          </div>

          {!compact && dated.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Category dates">
              {dated.map((c) => (
                <li
                  key={c.id}
                  className="inline-flex items-center gap-2 rounded-full border border-court-foreground/20 bg-court-foreground/8 px-3 py-1 text-xs sm:text-sm"
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-court-foreground/75">
                    {formatDate(c.event_date)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!compact && tournament.description && (
        <p className="whitespace-pre-wrap border-t border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground sm:px-7">
          {tournament.description}
        </p>
      )}
    </section>
  );
}

/**
 * A pickleball court seen from above, stretched to fill the header: the
 * outer lines, the net across the middle, the two kitchens (non-volley
 * zones, 7 ft either side of a 44 ft court) tinted, and the centre lines
 * splitting the service boxes. Strokes don't scale, so the lines stay crisp
 * at any header size. Decorative only.
 */
function CourtBackdrop() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 44 20"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-2.5 -z-10 size-[calc(100%-1.25rem)] text-court-foreground sm:inset-3.5 sm:size-[calc(100%-1.75rem)]"
    >
      {/* Kitchens */}
      <rect x="15" y="0" width="14" height="20" className="fill-current opacity-[0.06]" />
      <g
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      >
        {/* Boundary */}
        <rect x="0" y="0" width="44" height="20" vectorEffect="non-scaling-stroke" />
        {/* Kitchen lines */}
        <line x1="15" y1="0" x2="15" y2="20" vectorEffect="non-scaling-stroke" />
        <line x1="29" y1="0" x2="29" y2="20" vectorEffect="non-scaling-stroke" />
        {/* Centre lines: baseline to kitchen on each side */}
        <line x1="0" y1="10" x2="15" y2="10" vectorEffect="non-scaling-stroke" />
        <line x1="29" y1="10" x2="44" y2="10" vectorEffect="non-scaling-stroke" />
      </g>
      {/* The net, in ball color */}
      <line
        x1="22"
        y1="-1"
        x2="22"
        y2="21"
        stroke="var(--ball)"
        strokeOpacity="0.55"
        strokeWidth="3"
        strokeDasharray="2 4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
