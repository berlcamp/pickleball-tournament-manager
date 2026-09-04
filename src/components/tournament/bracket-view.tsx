"use client";

import { useState } from "react";
import { ScoreDialog, type SetScore } from "@/components/tournament/score-dialog";
import { submitFinalScore } from "@/actions/finals";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

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

function score(sets: SetScore[], side: 1 | 2) {
  return sets.reduce(
    (acc, s) =>
      acc + (side === 1 ? s.participant1_score : s.participant2_score),
    0,
  );
}

function MatchCard({
  m,
  canScore,
  onScore,
}: {
  m: FinalMatchVM;
  canScore: boolean;
  onScore: () => void;
}) {
  const ready = m.team1.id && m.team2.id;
  const rows: {
    id: string | null;
    name: string;
    seed: string | null;
    pts: number;
  }[] = [
    {
      id: m.team1.id,
      name: m.team1.name,
      seed: m.team1.seed,
      pts: score(m.sets, 1),
    },
    {
      id: m.team2.id,
      name: m.team2.name,
      seed: m.team2.seed,
      pts: score(m.sets, 2),
    },
  ];
  return (
    <div className="glass w-60 rounded-xl p-3 transition-all hover:ring-1 hover:ring-primary/40">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {m.label}
        </span>
        {canScore && ready && (
          <button
            onClick={onScore}
            className="text-muted-foreground hover:text-primary"
            aria-label="Enter score"
          >
            <Pencil className="size-3.5" />
          </button>
        )}
      </div>
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div
            key={i}
            className={cn(
              "flex items-center justify-between rounded-md px-2 py-1.5 text-sm",
              m.winnerId && r.id === m.winnerId
                ? "bg-primary/15 font-bold text-primary"
                : "bg-card/40",
            )}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {r.seed && (
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
                  {r.seed}
                </span>
              )}
              {/* The card is a fixed width, so a long pairing is cut off —
                  hovering the name spells it out in full. */}
              <Tooltip>
                <TooltipTrigger render={<span className="truncate" />}>
                  {r.name}
                </TooltipTrigger>
                <TooltipContent>{r.name}</TooltipContent>
              </Tooltip>
            </span>
            <span className="tabular-nums text-muted-foreground">
              {m.sets.length ? r.pts : "–"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

const ROUND_TITLE = (round: number, total: number) => {
  const fromEnd = total - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${round}`;
};

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
  const totalRounds = Math.max(...rounds.map((r) => r.round), 1);

  return (
    <>
      <div className="no-scrollbar overflow-x-auto pb-2">
        <div className="flex gap-8">
          {rounds.map((r) => (
            <div key={r.round} className="flex flex-col gap-4">
              <h4 className="text-sm font-semibold text-muted-foreground">
                {ROUND_TITLE(r.round, totalRounds)}
              </h4>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {r.matches.map((m) => (
                  <MatchCard
                    key={m.id}
                    m={m}
                    canScore={canScore}
                    onScore={() => setActive(m)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {active && (
        <ScoreDialog
          open={!!active}
          onOpenChange={(v) => !v && setActive(null)}
          team1={active.team1.name}
          team2={active.team2.name}
          initialSets={active.sets}
          onSubmit={(sets) => submitFinalScore(tournamentId, active.id, sets)}
        />
      )}
    </>
  );
}
