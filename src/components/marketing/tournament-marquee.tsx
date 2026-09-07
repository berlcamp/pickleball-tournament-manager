import { Trophy, Users } from "lucide-react";
import type { ShowcaseTournament } from "@/lib/data";
import type { TournamentStatus } from "@/types";

/** Seconds each card spends crossing the row — slow enough to actually read. */
const SECONDS_PER_CARD = 12;

/** What the pill on a card reads, per rolled-up tournament status. */
const STAGE_LABEL: Record<TournamentStatus, string> = {
  draft: "Coming up",
  group_stage: "Group stage",
  final_stage: "In the finals",
  completed: "Champion crowned",
};

/**
 * The showcase row on the marketing page: the tournaments the super admin has
 * featured, drifting sideways forever.
 *
 * Pure CSS (see `.marquee-track` in globals.css), so it needs no client
 * component. The list is rendered twice — the animation slides the track by
 * exactly one copy, and the duplicate is hidden from assistive tech. The cards
 * are display only: nothing on them is clickable or focusable.
 */
export function TournamentMarquee({
  tournaments,
}: {
  tournaments: ShowcaseTournament[];
}) {
  if (tournaments.length === 0) return null;

  // Short lists would otherwise leave a gap: repeat until the row is wide
  // enough that the duplicate copy always covers the viewport.
  const cards =
    tournaments.length >= 4
      ? tournaments
      : [...tournaments, ...tournaments, ...tournaments].slice(
          0,
          Math.max(4, tournaments.length * 2),
        );

  return (
    <section className="w-full pb-20">
      <div className="mb-7 flex flex-col items-center text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/50 px-4 py-1.5 text-xs font-medium text-muted-foreground">
          <Trophy className="size-4 text-primary" />
          Featured tournaments
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
          Real tournaments, <span className="text-gradient">already run</span>
        </h2>
      </div>

      <div
        className="marquee relative overflow-hidden"
        style={{
          maskImage:
            "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
          WebkitMaskImage:
            "linear-gradient(to right, transparent, black 6%, black 94%, transparent)",
        }}
      >
        <div
          className="marquee-track py-2"
          style={
            {
              "--marquee-duration": `${cards.length * SECONDS_PER_CARD}s`,
            } as React.CSSProperties
          }
        >
          <ul className="flex shrink-0 gap-5">
            {cards.map((t, i) => (
              <ShowcaseCard key={`a-${t.id}-${i}`} tournament={t} />
            ))}
          </ul>
          <ul className="flex shrink-0 gap-5" aria-hidden="true">
            {cards.map((t, i) => (
              <ShowcaseCard key={`b-${t.id}-${i}`} tournament={t} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ShowcaseCard({
  tournament: t,
}: {
  tournament: ShowcaseTournament;
}) {
  const done = t.status === "completed";
  return (
    <li className="shrink-0">
      <div className="glass flex h-full w-72 flex-col overflow-hidden rounded-3xl sm:w-80">
        <div
          className="relative h-28 bg-gradient-to-br from-primary/35 via-chart-2/25 to-chart-4/20"
          style={
            t.banner
              ? {
                  backgroundImage: `url(${t.banner})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        >
          {!t.banner && (
            <Trophy className="absolute -bottom-3 -right-2 size-24 text-primary/20" />
          )}
          <span
            className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${
              done
                ? "bg-primary/85 text-primary-foreground"
                : "bg-chart-4/85 text-background"
            }`}
          >
            {STAGE_LABEL[t.status]}
          </span>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="line-clamp-2 font-semibold leading-snug tracking-tight">
            {t.name}
          </h3>
          <div className="mt-auto flex items-end justify-between border-t border-border/60 pt-4">
            <div>
              <div className="flex items-center gap-1.5 text-xl font-bold leading-none">
                <Users className="size-4 text-primary" />
                {t.teams}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Teams
              </div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold leading-none">
                {t.categories}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                {t.categories === 1 ? "Category" : "Categories"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </li>
  );
}
