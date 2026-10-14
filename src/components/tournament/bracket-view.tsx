"use client";

import { startTransition, useOptimistic, useState } from "react";
import { toast } from "sonner";
import {
  ScoreDialog,
  winnerOf,
  type SetScore,
} from "@/components/tournament/score-dialog";
import { ScrollFade } from "@/components/tournament/scroll-fade";
import { MatchStatusBadge } from "@/components/status-badge";
import { submitFinalScore } from "@/actions/finals";
import { cn } from "@/lib/utils";
import { Loader2, Pencil, Trophy } from "lucide-react";

export interface FinalMatchVM {
  id: string;
  round: number;
  slot: number;
  label: string;
  team1: { id: string | null; name: string; seed: string | null };
  team2: { id: string | null; name: string; seed: string | null };
  status: "pending" | "in_progress" | "completed";
  winnerId: string | null;
  sets: SetScore[];
}

export interface BracketRound {
  round: number;
  matches: FinalMatchVM[];
}

type CardVM = FinalMatchVM & { saving: boolean };

const ROUND_TITLE = (round: number, total: number) => {
  const fromEnd = total - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${round}`;
};

function MatchCard({
  m,
  isFinal,
  canScore,
  onScore,
}: {
  m: CardVM;
  isFinal: boolean;
  canScore: boolean;
  onScore: () => void;
}) {
  const ready = Boolean(m.team1.id && m.team2.id);
  const scorable = canScore && ready;
  const decided = m.status === "completed" && m.winnerId !== null;
  const live = m.status === "in_progress";

  const body = (
    <>
      <div className="flex min-h-7 items-center justify-between gap-2 px-3 pt-2">
        <span className="eyebrow truncate text-xs">{m.label}</span>
        {m.saving ? (
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" /> Saving
          </span>
        ) : live ? (
          <MatchStatusBadge status={m.status} />
        ) : scorable ? (
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
            <Pencil className="size-3.5" />
            {m.status === "completed" ? "Edit" : "Score"}
          </span>
        ) : null}
      </div>
      <div className="space-y-0.5 p-1.5 pt-1">
        {([1, 2] as const).map((side) => {
          const team = side === 1 ? m.team1 : m.team2;
          const won = decided && team.id === m.winnerId;
          const lost = decided && !won;
          return (
            <div
              key={side}
              className={cn(
                "flex min-h-9 items-center gap-2 rounded-lg px-1.5",
                won && "bg-primary/10",
              )}
            >
              <span
                className={cn(
                  "scoreboard grid h-6 min-w-7 shrink-0 place-items-center rounded-md px-1 text-sm font-semibold",
                  won
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {team.seed ?? "–"}
              </span>
              {/* The card is a fixed width, so a long pairing is cut off —
                  the title spells it out in full on hover. */}
              <span
                title={team.name}
                className={cn(
                  "min-w-0 flex-1 truncate text-left text-sm",
                  won && "font-bold text-primary",
                  lost && "text-muted-foreground",
                  !decided && "font-medium",
                  !team.id && "text-muted-foreground italic",
                )}
              >
                {team.name}
              </span>
              {won && isFinal && (
                <Trophy className="size-4 shrink-0 text-ball-foreground dark:text-ball" aria-label="Champion" />
              )}
              <span className="flex shrink-0 gap-1">
                {m.sets.length === 0 ? (
                  <span className="scoreboard w-5 text-center text-lg font-bold text-muted-foreground/40">
                    –
                  </span>
                ) : (
                  m.sets.map((s, i) => {
                    const mine =
                      side === 1 ? s.participant1_score : s.participant2_score;
                    const theirs =
                      side === 1 ? s.participant2_score : s.participant1_score;
                    return (
                      <span
                        key={i}
                        className={cn(
                          "scoreboard w-5 text-center text-lg font-bold leading-none",
                          mine > theirs
                            ? won
                              ? "text-primary"
                              : "text-foreground"
                            : "text-muted-foreground/60",
                        )}
                      >
                        {mine}
                      </span>
                    );
                  })
                )}
              </span>
            </div>
          );
        })}
      </div>
    </>
  );

  const frame = cn(
    "block w-60 overflow-hidden rounded-xl border bg-card text-left shadow-card",
    live ? "border-ball ring-2 ring-ball/50" : "border-border",
    isFinal && decided && "border-primary/50",
  );

  // The whole card is the tap target when it can be scored — far easier to
  // hit courtside than a small pencil icon.
  if (scorable) {
    return (
      <button
        type="button"
        onClick={onScore}
        aria-busy={m.saving || undefined}
        aria-label={`${m.label}: ${m.status === "completed" ? "edit score" : "enter score"} for ${m.team1.name} vs ${m.team2.name}`}
        className={cn(
          frame,
          "transition-[border-color,box-shadow,transform] duration-150 outline-none hover:border-primary/50 hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.98]",
        )}
      >
        {body}
      </button>
    );
  }
  return (
    <div className={frame} aria-busy={m.saving || undefined}>
      {body}
    </div>
  );
}

/**
 * The knockout bracket: one column per round, joined by connector lines.
 * Each match sits in an equal share of its column's height, so a match is
 * always centred between the two that feed it and the connectors meet it
 * exactly, whatever the field size. The third-place playoff shares the
 * final's round number but is fed by the semifinal *losers*, so it is drawn
 * apart from the tree rather than wired into it.
 *
 * Used on the dashboard and on the public portal (where `canScore` is false).
 */
export function BracketView({
  tournamentId,
  rounds,
  canScore,
}: {
  tournamentId: string;
  rounds: BracketRound[];
  canScore: boolean;
}) {
  const [active, setActive] = useState<FinalMatchVM | null>(null);
  // Optimistic scores, as on the group stage: shown at once, replaced by the
  // revalidated bracket when the save returns, dropped if it failed. Feeding
  // the winner into the next round is the server's job and arrives with that
  // same response.
  const [unsaved, addUnsaved] = useOptimistic<
    Record<string, SetScore[]>,
    { id: string; sets: SetScore[] }
  >({}, (state, a) => ({ ...state, [a.id]: a.sets }));

  const totalRounds = Math.max(...rounds.map((r) => r.round), 1);

  function view(m: FinalMatchVM): CardVM {
    const sets = unsaved[m.id];
    if (!sets) return { ...m, saving: false };
    return {
      ...m,
      sets,
      status: "completed",
      winnerId: winnerOf(sets, m.team1.id, m.team2.id),
      saving: true,
    };
  }

  function save(match: FinalMatchVM, sets: SetScore[]) {
    startTransition(async () => {
      addUnsaved({ id: match.id, sets });
      const res = await submitFinalScore(tournamentId, match.id, sets);
      if (!res.ok) {
        toast.error(
          `${match.label} score wasn't saved. ${res.error ?? ""}`.trim(),
          { action: { label: "Retry", onClick: () => save(match, sets) } },
        );
      }
    });
  }

  // The tree is every round in slot order, except that the final round keeps
  // only the final itself (slot 0); anything else there is a playoff.
  const tree = rounds.map((r) =>
    r.round === totalRounds
      ? { ...r, matches: r.matches.filter((m) => m.slot === 0).map(view) }
      : { ...r, matches: r.matches.map(view) },
  );
  const extras = rounds
    .filter((r) => r.round === totalRounds)
    .flatMap((r) => r.matches.filter((m) => m.slot !== 0))
    .map(view);
  const last = tree.length - 1;

  return (
    <div className="space-y-6">
      <ScrollFade className="-mx-1 px-1 pb-2">
        <div className="flex w-max gap-10">
          {tree.map((r, ri) => (
            <div key={r.round} className="flex w-60 shrink-0 flex-col">
              <h4 className="eyebrow mb-2 flex h-6 items-center gap-1.5">
                {ri === last && r.round === totalRounds && (
                  <Trophy className="size-3.5 text-primary" />
                )}
                {ROUND_TITLE(r.round, totalRounds)}
              </h4>
              <div className="flex flex-1 flex-col">
                {r.matches.map((m, mi) => {
                  const decided = m.status === "completed" && m.winnerId;
                  return (
                    <div
                      key={m.id}
                      className="relative flex flex-1 items-center py-2"
                    >
                      {ri > 0 && (
                        <span
                          aria-hidden
                          className="absolute top-1/2 right-full w-5 border-t-2 border-border"
                        />
                      )}
                      {ri < last && (
                        <>
                          <span
                            aria-hidden
                            className={cn(
                              "absolute top-1/2 left-full w-5 border-t-2",
                              decided ? "border-primary/60" : "border-border",
                            )}
                          />
                          <span
                            aria-hidden
                            className={cn(
                              "absolute left-[calc(100%+1.25rem-2px)] border-l-2 border-border",
                              mi % 2 === 0 ? "top-1/2 bottom-0" : "top-0 bottom-1/2",
                            )}
                          />
                        </>
                      )}
                      <MatchCard
                        m={m}
                        isFinal={ri === last && r.round === totalRounds}
                        canScore={canScore}
                        onScore={() => setActive(m)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollFade>

      {extras.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {extras.map((m) => (
            <div key={m.id} className="space-y-2">
              <h4 className="eyebrow">{m.label} playoff</h4>
              <MatchCard
                m={m}
                isFinal={false}
                canScore={canScore}
                onScore={() => setActive(m)}
              />
            </div>
          ))}
        </div>
      )}

      {active && (
        <ScoreDialog
          key={active.id}
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          title={active.label}
          team1={active.team1.name}
          team2={active.team2.name}
          initialSets={unsaved[active.id] ?? active.sets}
          requireWinner
          onSubmit={(sets) => save(active, sets)}
        />
      )}
    </div>
  );
}
