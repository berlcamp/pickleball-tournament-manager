import { CalendarDays, MapPin } from "lucide-react";
import { formatDate, formatEventDates } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CourtBackdrop } from "@/components/court-backdrop";
import { ShareFacebookButton } from "@/components/public/share-facebook-button";
import type { Category, Tournament } from "@/types";

/**
 * Hero for the public portal: the tournament's name, date and venue on a
 * court-green header drawn as a pickleball court, then the day each category
 * is played.
 *
 * Categories run on their own days, so the headline date is derived from
 * them — a single day when they all share one, a range when they don't.
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
  /** Status page: tighter padding, no category days. */
  compact?: boolean;
}) {
  // Only dated categories are published; an undated one simply isn't announced.
  const dated = categories
    .filter((c) => c.event_date)
    .sort((a, b) => (a.event_date! < b.event_date! ? -1 : 1));
  // Dates are per category; the headline is the span they cover.
  const headlineDate = formatEventDates(dated.map((c) => c.event_date));
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
              // Room on the right for the share button.
              compact ? "text-2xl sm:text-3xl" : "pr-20 text-[2rem] sm:pr-24 sm:text-5xl",
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

        {/* Not on the registrant's status page: that link is private. */}
        {!compact && (
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
            <ShareFacebookButton />
          </div>
        )}
      </div>

    </section>
  );
}

