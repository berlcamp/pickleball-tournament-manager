import Image from "next/image";
import { CalendarDays, MapPin } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Tournament } from "@/types";

/**
 * Hero for the public portal: the uploaded banner on top, then the tournament's
 * name, date and venue underneath.
 *
 * Nothing is drawn over the image — organisers upload a designed poster whose
 * own copy would otherwise sit behind ours. For the same reason the image keeps
 * its natural aspect ratio rather than being cropped to a fixed strip; a very
 * tall poster is capped and letterboxed instead of taking over the page.
 */
export function TournamentBanner({ tournament }: { tournament: Tournament }) {
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
        className={`p-5 sm:p-7 ${tournament.banner ? "border-t border-white/10" : ""}`}
      >
        <h1 className="text-balance text-2xl font-bold leading-tight sm:text-4xl">
          {tournament.name}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground sm:text-base">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4 shrink-0 text-primary" />
            {formatDate(tournament.start_date)}
          </span>
          {tournament.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-4 shrink-0 text-primary" />
              {tournament.location}
            </span>
          )}
        </div>

        {tournament.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {tournament.description}
          </p>
        )}
      </div>
    </section>
  );
}
