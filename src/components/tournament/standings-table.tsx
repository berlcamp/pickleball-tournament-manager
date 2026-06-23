import { StandingStatusBadge, WLBadge } from "@/components/status-badge";
import type { StandingStatus } from "@/types";

export interface StandingRow {
  participantId: string;
  rank: number;
  status: StandingStatus;
  name: string;
  matchesWon: number;
  matchesLost: number;
  matchesTied: number;
  tieBreak: number;
  setWins: number;
  setTies: number;
  points: number;
  history: ("W" | "L" | "T")[];
}

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <div className="glass overflow-x-auto rounded-2xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-3">Rank</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Team</th>
            <th className="px-3 py-3 text-center">W-L-T</th>
            <th className="px-3 py-3 text-right">TB</th>
            <th className="px-3 py-3 text-right">Set W</th>
            <th className="px-3 py-3 text-right">Set T</th>
            <th className="px-3 py-3 text-right">Pts</th>
            <th className="px-3 py-3">History</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.participantId}
              className="border-b border-white/5 last:border-0 hover:bg-accent/30"
            >
              <td className="px-3 py-3 font-bold">{r.rank}</td>
              <td className="px-3 py-3">
                <StandingStatusBadge status={r.status} />
              </td>
              <td className="px-3 py-3 font-medium">{r.name}</td>
              <td className="px-3 py-3 text-center tabular-nums">
                {r.matchesWon}-{r.matchesLost}-{r.matchesTied}
              </td>
              <td className="px-3 py-3 text-right tabular-nums">{r.tieBreak}</td>
              <td className="px-3 py-3 text-right tabular-nums">{r.setWins}</td>
              <td className="px-3 py-3 text-right tabular-nums">{r.setTies}</td>
              <td className="px-3 py-3 text-right font-semibold tabular-nums">
                {r.points}
              </td>
              <td className="px-3 py-3">
                <div className="flex gap-1">
                  {r.history.length === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    r.history.map((h, i) => <WLBadge key={i} result={h} />)
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
