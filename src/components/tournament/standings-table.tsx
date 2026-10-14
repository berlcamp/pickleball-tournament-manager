import { StandingStatusBadge, WLBadge } from "@/components/status-badge";
import { RankingHelpDialog } from "@/components/tournament/ranking-help-dialog";
import { ScrollFade } from "@/components/tournament/scroll-fade";
import { ADVANCE_PER_GROUP } from "@/lib/constants";
import { cn } from "@/lib/utils";
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
const diffClass = (n: number) =>
  n > 0 ? "text-success" : n < 0 ? "text-destructive" : "text-muted-foreground";

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
    <div className="space-y-2 border-t border-border px-3 py-3">
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
                    <span className="scoreboard text-muted-foreground">#{r.rank}</span>
                    <span className="font-medium">{r.name}</span>
                  </span>
                  <span
                    className={cn(
                      "scoreboard text-base font-bold",
                      diffClass(r.pointDiff),
                    )}
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

// The rank and team columns stay pinned while the numbers scroll under them
// on a phone, so they need an opaque background; a qualifier row's tint is
// mixed into it rather than layered on top.
const STICKY_BG = "bg-card group-hover/row:bg-[color-mix(in_oklch,var(--muted)_60%,var(--card))]";
const STICKY_QUALIFIER_BG =
  "bg-[color-mix(in_oklch,var(--primary)_7%,var(--card))] group-hover/row:bg-[color-mix(in_oklch,var(--primary)_11%,var(--card))]";

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  // Standings rows exist (rank 0) before anyone has played. Until a result is
  // in, there is no order to show: no rank, no qualifier tint, no tie notes —
  // otherwise every team reads as "0" and as qualifying.
  const started = rows.some(
    (r) => r.matchesWon + r.matchesLost + r.matchesTied > 0,
  );
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span aria-hidden className="h-3.5 w-1 rounded-full bg-primary" />
          Top {ADVANCE_PER_GROUP} qualify for the finals
        </span>
        <RankingHelpDialog />
      </div>
      <ScrollFade>
        <table className="w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left font-heading text-[0.8125rem] font-semibold uppercase tracking-wider text-muted-foreground">
              <th
                scope="col"
                className={cn("sticky left-0 z-10 w-12 px-3 py-2.5 text-center", STICKY_BG)}
              >
                #
              </th>
              <th
                scope="col"
                className={cn("sticky left-12 z-10 min-w-36 px-2 py-2.5", STICKY_BG)}
              >
                Team
              </th>
              <th scope="col" className="px-3 py-2.5 text-center" title="Matches won – lost – tied">
                W-L-T
              </th>
              <th scope="col" className="px-3 py-2.5 text-right" title="Head-to-head wins among tied teams">
                H2H
              </th>
              <th scope="col" className="px-3 py-2.5 text-right" title="Sets won">
                Sets
              </th>
              <th scope="col" className="px-3 py-2.5 text-right" title="Sets tied">
                Set T
              </th>
              <th scope="col" className="px-3 py-2.5 text-right" title="Point differential">
                +/-
              </th>
              <th scope="col" className="px-3 py-2.5 text-right" title="Total points scored">
                Pts
              </th>
              <th scope="col" className="px-3 py-2.5">
                Form
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const qualifies = started && r.rank <= ADVANCE_PER_GROUP;
              const cell = "border-t border-border px-3 py-3";
              return (
                <tr
                  key={r.participantId}
                  className={cn(
                    "group/row transition-colors duration-150",
                    qualifies
                      ? "bg-primary/7 hover:bg-primary/11"
                      : "hover:bg-muted/60",
                  )}
                >
                  <td
                    className={cn(
                      cell,
                      "sticky left-0 z-10 w-12 text-center",
                      qualifies
                        ? cn(STICKY_QUALIFIER_BG, "shadow-[inset_4px_0_0_0_var(--primary)]")
                        : STICKY_BG,
                    )}
                  >
                    <span
                      className={cn(
                        "scoreboard text-2xl font-bold leading-none",
                        qualifies ? "text-primary" : "text-muted-foreground",
                      )}
                    >
                      {started ? r.rank : "–"}
                    </span>
                  </td>
                  <td
                    className={cn(
                      cell,
                      "sticky left-12 z-10 min-w-36 max-w-56 px-2",
                      qualifies ? STICKY_QUALIFIER_BG : STICKY_BG,
                    )}
                  >
                    <div className="flex flex-col items-start gap-1">
                      <span className="line-clamp-2 font-semibold leading-tight">
                        {r.name}
                      </span>
                      {r.status !== "none" && (
                        <StandingStatusBadge status={r.status} />
                      )}
                    </div>
                  </td>
                  <td className={cn(cell, "whitespace-nowrap text-center")}>
                    <span className="scoreboard text-xl font-bold">
                      {r.matchesWon}
                      <span className="text-muted-foreground">-</span>
                      {r.matchesLost}
                      <span className="text-muted-foreground">-</span>
                      {r.matchesTied}
                    </span>
                  </td>
                  <td className={cn(cell, "scoreboard text-right text-lg")}>
                    {r.tieBreak}
                  </td>
                  <td className={cn(cell, "scoreboard text-right text-lg")}>
                    {r.setWins}
                  </td>
                  <td className={cn(cell, "scoreboard text-right text-lg text-muted-foreground")}>
                    {r.setTies}
                  </td>
                  <td
                    className={cn(
                      cell,
                      "scoreboard text-right text-lg font-bold",
                      diffClass(r.pointDiff),
                    )}
                  >
                    {fmtDiff(r.pointDiff)}
                  </td>
                  <td className={cn(cell, "scoreboard text-right text-lg font-semibold")}>
                    {r.points}
                  </td>
                  <td className={cell}>
                    <div className="flex gap-1">
                      {r.history.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        r.history.map((h, i) => <WLBadge key={i} result={h} />)
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </ScrollFade>
      {started && <TieBreakDetails rows={rows} />}
    </div>
  );
}
