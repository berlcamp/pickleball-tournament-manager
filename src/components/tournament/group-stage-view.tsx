"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { MatchStatusBadge } from "@/components/status-badge";
import {
  StandingsTable,
  type StandingRow,
} from "@/components/tournament/standings-table";
import { ScoreDialog, type SetScore } from "@/components/tournament/score-dialog";
import { GroupStageControls } from "@/components/tournament/group-stage-controls";
import { submitGroupScore } from "@/actions/groupStage";
import type { TournamentStatus } from "@/types";
import { Pencil } from "lucide-react";

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

function setSummary(sets: SetScore[]) {
  if (!sets.length) return "—";
  return sets
    .map((s) => `${s.participant1_score}-${s.participant2_score}`)
    .join(", ");
}

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

  const allMatches = groups.flatMap((g) => g.matches);
  const matchesTotal = allMatches.length;
  const matchesDone = allMatches.filter(
    (m) => m.status === "completed",
  ).length;

  return (
    <>
      <GroupStageControls
        tournamentId={tournamentId}
        categoryId={categoryId}
        status={status}
        canManage={canManage}
        matchesDone={matchesDone}
        matchesTotal={matchesTotal}
      />

      <Tabs defaultValue={groups[0]?.id} className="space-y-4">
        <TabsList className="flex-wrap">
          {groups.map((g) => (
            <TabsTrigger key={g.id} value={g.id}>
              {g.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {groups.map((g) => (
          <TabsContent key={g.id} value={g.id} className="space-y-6">
            <StandingsTable rows={g.standings} />

            <div className="glass rounded-2xl p-2">
              <h4 className="px-3 py-2 text-sm font-semibold text-muted-foreground">
                Matches
              </h4>
              <ul className="divide-y divide-border/50">
                {g.matches.map((m) => {
                  const winner = m.winnerId;
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-3"
                    >
                      <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                        <span
                          className={`truncate text-right ${winner === m.team1.id ? "font-bold text-primary" : ""}`}
                        >
                          {m.team1.name}
                        </span>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-center text-xs tabular-nums">
                          {setSummary(m.sets)}
                        </span>
                        <span
                          className={`truncate ${winner === m.team2.id ? "font-bold text-primary" : ""}`}
                        >
                          {m.team2.name}
                        </span>
                      </div>
                      <MatchStatusBadge status={m.status} />
                      {canScore && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setActive(m)}
                        >
                          <Pencil className="size-3.5" />
                          {m.status === "completed" ? "Edit" : "Score"}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {active && (
        <ScoreDialog
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          team1={active.team1.name}
          team2={active.team2.name}
          initialSets={active.sets}
          onSubmit={(sets) =>
            submitGroupScore(tournamentId, active.id, sets)
          }
        />
      )}
    </>
  );
}
