import { Trophy } from "lucide-react";
import type { ShowcaseTournament } from "@/lib/data";
import type { TournamentStatus } from "@/types";

/** Seconds each card spends crossing the row — slow enough to actually read. */
const SECONDS_PER_CARD = 12;

/** Cards in one copy of the row, repeating the list if it is shorter. */
const MIN_CARDS = 6;

/** What the footer of a card reads, per rolled-up tournament status. */
const STAGE_LABEL: Record<TournamentStatus, string> = {
  draft: "Coming up",
  group_stage: "Group stage",
  final_stage: "In the finals",
  completed: "Champion crowned",
};

/** The dot beside that label. */
const STAGE_DOT: Record<TournamentStatus, string> = {
  draft: "bg-muted-foreground",
  group_stage: "bg-chart-2",
  final_stage: "bg-chart-4",
  completed: "bg-primary",
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

  // One copy of the row has to be at least as wide as the viewport, or the
  // seam shows as empty space. Short lists repeat until they are.
  const cards = [...tournaments];
  while (cards.length < MIN_CARDS) cards.push(...tournaments);

  return (
    <section className="w-full pb-24">
      <div className="mb-7 flex flex-col items-center text-center">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
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
  return (
    <li className="shrink-0">
      <article className="glass flex h-full w-56 flex-col overflow-hidden rounded-2xl sm:w-60">
        <div
          className="relative h-24 bg-gradient-to-br from-primary/35 via-chart-2/25 to-chart-4/20"
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
          {/* Tournaments without a banner get the gradient and a watermark. */}
          {!t.banner && (
            <Trophy className="absolute -bottom-2 -right-1 size-16 text-primary/20" />
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug tracking-tight">
            {t.name}
          </h3>
          <footer className="mt-auto flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <span className={`size-1.5 rounded-full ${STAGE_DOT[t.status]}`} />
            {STAGE_LABEL[t.status]}
          </footer>
        </div>
      </article>
    </li>
  );
}
