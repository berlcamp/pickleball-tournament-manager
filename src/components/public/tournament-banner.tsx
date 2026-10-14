import Image from "next/image";
import { CalendarDays, MapPin } from "lucide-react";
import { formatDate, formatEventDates } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Category, Tournament } from "@/types";

/**
 * Hero for the public portal: the uploaded banner on top, then the tournament's
 * name, date and venue on a court-green scoreboard bar, and finally the day
 * each category is played.
 *
 * Categories run on their own days, so the headline date is derived from them
 * when the organiser hasn't set a tournament-wide start date — a single day
 * when they all share one, a range when they don't.
 *
 * Nothing is drawn over the image — organisers upload a designed poster whose
 * own copy would otherwise sit behind ours. For the same reason the image keeps
 * its natural aspect ratio rather than being cropped to a fixed strip; a very
 * tall poster is capped and letterboxed (on court green) instead of taking
 * over the page.
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
      {tournament.banner && (
        <div className="flex justify-center bg-court">
          <Image
            src={tournament.banner}
            alt={`${tournament.name} poster`}
            width={1600}
            height={900}
            unoptimized
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className={cn(
              "h-auto w-full object-contain",
              compact ? "max-h-56" : "max-h-[70vh]",
            )}
          />
        </div>
      )}

      <div className="relative isolate">
        {!tournament.banner && (
          <div
            className="bg-court-lines absolute inset-0 -z-10 opacity-70"
            aria-hidden
          />
        )}
        <div className={cn("p-5 sm:p-7", compact && "sm:p-5")}>
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
