import Image from "next/image";
import { CalendarDays, MapPin } from "lucide-react";
import { formatDate, formatEventDates } from "@/lib/format";
import type { Category, Tournament } from "@/types";

/**
 * Hero for the public portal: the uploaded banner on top, then the tournament's
 * name, date and venue underneath, and finally the day each category is played.
 *
 * Categories run on their own days, so the headline date is derived from them
 * when the organiser hasn't set a tournament-wide start date — a single day
 * when they all share one, a range when they don't.
 *
 * Nothing is drawn over the image — organisers upload a designed poster whose
 * own copy would otherwise sit behind ours. For the same reason the image keeps
 * its natural aspect ratio rather than being cropped to a fixed strip; a very
 * tall poster is capped and letterboxed instead of taking over the page.
 */
export function TournamentBanner({
  tournament,
  categories = [],
}: {
  tournament: Tournament;
  categories?: Category[];
}) {
  // Only dated categories are published; an undated one simply isn't announced.
  const dated = categories
    .filter((c) => c.event_date)
    .sort((a, b) => (a.event_date! < b.event_date! ? -1 : 1));
  const headlineDate = formatEventDates(
    tournament.start_date,
    dated.map((c) => c.event_date),
  );

  return (
    <section className="glass overflow-hidden rounded-2xl shadow-xl">
      {tournament.banner && (
        <div className="flex justify-center bg-black/25">
          <Image
            src={tournament.banner}
            alt={`${tournament.name} banner`}
            width={1600}
            height={900}
            unoptimized
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="h-auto max-h-[70vh] w-full object-contain"
          />
        </div>
      )}

      <div
        className={`p-5 sm:p-7 ${tournament.banner ? "border-t border-border" : ""}`}
      >
        <h1 className="text-balance text-2xl font-bold leading-tight sm:text-4xl">
          {tournament.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground sm:text-base">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4 shrink-0 text-primary" />
            {headlineDate}
          </span>
          {tournament.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0 text-primary" />
              {tournament.location}
            </span>
          )}
        </div>

        {dated.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {dated.map((c) => (
              <li
                key={c.id}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 text-xs sm:text-sm"
              >
                <span className="font-semibold">{c.name}</span>
                <span className="text-muted-foreground">
                  {formatDate(c.event_date)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {tournament.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {tournament.description}
          </p>
        )}
      </div>
    </section>
  );
}
