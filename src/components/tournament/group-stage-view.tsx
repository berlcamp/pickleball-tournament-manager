"use client";

import { startTransition, useOptimistic, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MatchStatusBadge } from "@/components/status-badge";
import {
  StandingsTable,
  type StandingRow,
} from "@/components/tournament/standings-table";
import {
  ScoreDialog,
  winnerOf,
  type SetScore,
} from "@/components/tournament/score-dialog";
import { GroupStageControls } from "@/components/tournament/group-stage-controls";
import { submitGroupScore } from "@/actions/groupStage";
import { cn } from "@/lib/utils";
import type { TournamentStatus } from "@/types";
import { Check, Loader2, Pencil } from "lucide-react";

export interface MatchVM {
  id: string;
  round: number;
  team1: { id: string | null; name: string };
  team2: { id: string | null; name: string };
  status: "pending" | "in_progress" | "completed";
  sets: SetScore[];
  winnerId: string | null;
}

export interface GroupVM {
  id: string;
  name: string;
  matches: MatchVM[];
  standings: StandingRow[];
}

/** Scores typed in but not yet confirmed by the server, by match id. */
type Unsaved = Record<string, SetScore[]>;

export function GroupStageView({
  tournamentId,
  categoryId,
  groups,
  status,
  canManage,
  canScore,
}: {
  tournamentId: string;
  categoryId: string;
  groups: GroupVM[];
  status: TournamentStatus;
  canManage: boolean;
  canScore: boolean;
}) {
  const [active, setActive] = useState<MatchVM | null>(null);
  // A score being saved shows on its row straight away. The entry lives only
  // as long as the save's transition: once the action returns, the
  // revalidated page carries the real result and this falls back to `{}` —
  // which is also the rollback if the save failed.
  const [unsaved, addUnsaved] = useOptimistic<
    Unsaved,
    { id: string; sets: SetScore[] }
  >({}, (state, a) => ({ ...state, [a.id]: a.sets }));

  // Each match row reads through this, so the optimistic score, winner and
  // "Final" status all appear together.
  function view(m: MatchVM) {
    const sets = unsaved[m.id];
    if (!sets) return { ...m, saving: false };
    return {
      ...m,
      sets,
      status: "completed" as const,
      winnerId: winnerOf(sets, m.team1.id, m.team2.id),
      saving: true,
    };
  }

  // Resolves once the server has answered, so the dialog can stay open (and
  // locked) until then. The optimistic row update still shows behind it and
  // is dropped automatically if the save failed.
  function save(match: MatchVM, sets: SetScore[]) {
    return new Promise<string | null>((resolve) => {
      startTransition(async () => {
        addUnsaved({ id: match.id, sets });
        const res = await submitGroupScore(tournamentId, match.id, sets);
        resolve(res.ok ? null : (res.error ?? "Something went wrong."));
      });
    });
  }


  const views = groups.map((g) => ({ ...g, matches: g.matches.map(view) }));
  const allMatches = views.flatMap((g) => g.matches);
  const matchesTotal = allMatches.length;
  const matchesDone = allMatches.filter((m) => m.status === "completed").length;

  return (
    <>
      <GroupStageControls
        tournamentId={tournamentId}
        categoryId={categoryId}
        status={status}
        canManage={canManage}
        canScore={canScore}
        matchesDone={matchesDone}
        matchesTotal={matchesTotal}
      />

      <Tabs defaultValue={groups[0]?.id} className="gap-4">
        <TabsList className="h-auto group-data-horizontal/tabs:h-auto w-full flex-wrap justify-start gap-1 rounded-xl p-1 sm:w-fit">
          {views.map((g) => {
            const done = g.matches.filter((m) => m.status === "completed").length;
            return (
              <TabsTrigger
                key={g.id}
                value={g.id}
                className="min-h-11 flex-none gap-2 rounded-lg px-4 font-heading text-base font-semibold uppercase tracking-wide sm:min-h-9 data-active:bg-court data-active:text-court-foreground dark:data-active:bg-court dark:data-active:text-court-foreground"
              >
                {g.name}
                <span className="scoreboard text-sm font-medium opacity-70">
                  {done}/{g.matches.length}
                </span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {views.map((g) => (
          <TabsContent key={g.id} value={g.id} className="space-y-6">
            <StandingsTable rows={g.standings} />
            <MatchList
              matches={g.matches}
              canScore={canScore}
              onScore={(m) => setActive(m)}
            />
          </TabsContent>
        ))}
      </Tabs>

      {active && (
        <ScoreDialog
          key={active.id}
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          title={`Round ${active.round} score`}
          team1={active.team1.name}
          team2={active.team2.name}
          initialSets={unsaved[active.id] ?? active.sets}
          onSubmit={(sets) => save(active, sets)}
        />
      )}
    </>
  );
}

type MatchRowVM = MatchVM & { saving: boolean };

/** Matches grouped under their round, each laid out like a scoreboard. */
function MatchList({
  matches,
  canScore,
  onScore,
}: {
  matches: MatchRowVM[];
  canScore: boolean;
  onScore: (m: MatchVM) => void;
}) {
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);

  return (
    <section className="glass overflow-hidden rounded-2xl">
      <h3 className="border-b border-border px-4 py-3 font-heading text-xl font-bold">
        Matches
      </h3>
      {rounds.map((round) => (
        <div key={round}>
          <p className="eyebrow bg-muted/50 px-4 py-1.5">Round {round}</p>
          <ul className="divide-y divide-border">
            {matches
              .filter((m) => m.round === round)
              .map((m) => (
                <li
                  key={m.id}
                  aria-busy={m.saving || undefined}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    m.status === "in_progress" && "bg-ball/10",
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <TeamLine match={m} side={1} />
                    <TeamLine match={m} side={2} />
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    {m.saving ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        Saving
                      </span>
                    ) : (
                      <MatchStatusBadge status={m.status} />
                    )}
                    {canScore && (
                      <Button
                        size="sm"
                        variant={m.status === "completed" ? "outline" : "default"}
                        onClick={() => onScore(m)}
                        aria-label={`${m.status === "completed" ? "Edit score" : "Enter score"}: ${m.team1.name} vs ${m.team2.name}`}
                      >
                        <Pencil className="size-3.5" />
                        {m.status === "completed" ? "Edit" : "Score"}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

/** One team's line of a match: name, then its points in each set. */
function TeamLine({ match, side }: { match: MatchRowVM; side: 1 | 2 }) {
  const team = side === 1 ? match.team1 : match.team2;
  const decided = match.status === "completed" && match.winnerId !== null;
  const won = decided && match.winnerId === team.id;
  const lost = decided && !won;

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 text-[0.9375rem]",
          won && "font-bold text-primary",
          lost && "text-muted-foreground",
          !decided && "font-medium",
        )}
      >
        <span className="truncate">{team.name}</span>
        {won && <Check className="size-4 shrink-0" aria-label="Winner" />}
      </span>
      <span className="flex shrink-0 gap-1">
        {match.sets.length === 0 ? (
          <span className="scoreboard w-7 text-center text-xl font-bold text-muted-foreground/50">
            –
          </span>
        ) : (
          match.sets.map((s, i) => {
            const mine = side === 1 ? s.participant1_score : s.participant2_score;
            const theirs = side === 1 ? s.participant2_score : s.participant1_score;
            return (
              <span
                key={i}
                className={cn(
                  "scoreboard w-7 text-center text-xl font-bold leading-none",
                  mine > theirs ? "text-foreground" : "text-muted-foreground/60",
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
}
