import { StandingStatusBadge, WLBadge } from "@/components/status-badge";
import { RankingHelpDialog } from "@/components/tournament/ranking-help-dialog";
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
  pointDiff: number;
  history: ("W" | "L" | "T")[];
}

const fmtDiff = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/**
 * Group teams that are still level when point differential is reached, i.e.
 * teams sharing the same match record (wins), head-to-head (tieBreak) AND set
 * wins — the three rules that come before differential in
 * `computeGroupStandings`. Rows are already sorted by final rank, so tied teams
 * are always adjacent.
 */
function findTieClusters(rows: StandingRow[]): StandingRow[][] {
  const clusters: StandingRow[][] = [];
  let current: StandingRow[] = [];
  const sameTier = (a: StandingRow, b: StandingRow) =>
    a.matchesWon === b.matchesWon &&
    a.tieBreak === b.tieBreak &&
    a.setWins === b.setWins;

  for (const row of rows) {
    if (current.length === 0 || sameTier(current[current.length - 1], row)) {
      current.push(row);
    } else {
      if (current.length >= 2) clusters.push(current);
      current = [row];
    }
  }
  if (current.length >= 2) clusters.push(current);
  return clusters;
}

function TieBreakDetails({ rows }: { rows: StandingRow[] }) {
  const clusters = findTieClusters(rows);
  if (clusters.length === 0) return null;

  return (
    <div className="space-y-2 px-3 py-3">
      {clusters.map((cluster) => {
        const h2hDecided = cluster.some(
          (r, i) => i > 0 && r.pointDiff === cluster[i - 1].pointDiff,
        );
        return (
          <div
            key={cluster[0].participantId}
            className="rounded-xl border border-border bg-muted/30 p-3 text-xs"
          >
            <p className="mb-2 font-medium text-muted-foreground">
              {cluster.length}-way tie · same record and {cluster[0].setWins} set
              wins — ranked by point differential
            </p>
            <ol className="space-y-1">
              {cluster.map((r) => (
                <li
                  key={r.participantId}
                  className="flex items-center justify-between gap-3 tabular-nums"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-muted-foreground">#{r.rank}</span>
                    <span className="font-medium">{r.name}</span>
                  </span>
                  <span
                    className={
                      r.pointDiff > 0
                        ? "text-emerald-400"
                        : r.pointDiff < 0
                          ? "text-red-400"
                          : "text-muted-foreground"
                    }
                  >
                    {fmtDiff(r.pointDiff)}
                  </span>
                </li>
              ))}
            </ol>
            {h2hDecided && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Where teams share the same differential, total points and then
                the head-to-head result decided the order.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  return (
    <div className="glass rounded-2xl">
      <div className="flex justify-end px-2 pt-2">
        <RankingHelpDialog />
      </div>
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
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
              className="border-b border-border/50 last:border-0 hover:bg-accent/30"
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
      <TieBreakDetails rows={rows} />
    </div>
  );
}
