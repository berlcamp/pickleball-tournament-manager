import Image from "next/image";
import { CalendarDays, MapPin } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Tournament } from "@/types";

/**
 * Hero banner for the public portal. The uploaded image is the backdrop with
 * the tournament's name, date and venue laid over a gradient scrim so text
 * stays readable on any photo. Falls back to a branded gradient when no banner
 * has been uploaded.
 */
export function TournamentBanner({ tournament }: { tournament: Tournament }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 shadow-xl">
      <div className="relative h-48 w-full sm:h-64 lg:h-72">
        {tournament.banner ? (
          <Image
            src={tournament.banner}
            alt=""
            fill
            unoptimized
            priority
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-app-gradient bg-card" />
        )}
        {/* Scrim: dark at the bottom where the copy sits, lighter at the top. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/10" />

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <h1 className="text-balance text-2xl font-bold leading-tight text-white drop-shadow sm:text-4xl">
            {tournament.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/85">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {formatDate(tournament.start_date)}
            </span>
            {tournament.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" />
                {tournament.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {tournament.description && (
        <div className="glass border-t border-white/10 px-5 py-4 sm:px-7">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {tournament.description}
          </p>
        </div>
      )}
    </section>
  );
}
