import Link from "next/link";
import {
  publicClient,
  getTournamentByPublicRef,
  getPublicCategories,
  aggregateStatus,
} from "@/lib/data";
import { loadGroupStage } from "@/lib/tournament-data";
import { MonitorBoard, type MonitorCategory } from "@/components/public/monitor-board";
import { TournamentStatusBadge } from "@/components/status-badge";
import { Tv } from "lucide-react";
import type { Tournament, TournamentStatus } from "@/types";

export const dynamic = "force-dynamic";

export default async function MonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;

  if (t) {
    const tournament = await getTournamentByPublicRef(t);
    if (tournament) {
      const db = await publicClient();
      const publicCategories = await getPublicCategories(tournament.id);
      const categories: MonitorCategory[] = await Promise.all(
        publicCategories.map(async (c) => ({
          id: c.id,
          name: c.name,
          groups: await loadGroupStage(db, c.id),
        })),
      );
      return (
        <MonitorBoard tournamentName={tournament.name} categories={categories} />
      );
    }
  }

  const db = await publicClient();
  // Active tournaments = those with at least one category in group/final stage.
  const { data: catRows } = await db
    .from("categories")
    .select("status, tournament_id, tournaments(*)")
    .in("status", ["group_stage", "final_stage"]);

  const byTournament = new Map<
    string,
    { tournament: Tournament; statuses: TournamentStatus[] }
  >();
  for (const row of (catRows ?? []) as unknown as {
    status: TournamentStatus;
    tournament_id: string;
    tournaments: Tournament | null;
  }[]) {
    if (!row.tournaments) continue;
    const entry = byTournament.get(row.tournament_id) ?? {
      tournament: row.tournaments,
      statuses: [],
    };
    entry.statuses.push(row.status);
    byTournament.set(row.tournament_id, entry);
  }

  const tournaments = [...byTournament.values()]
    .map((e) => ({ ...e.tournament, status: aggregateStatus(e.statuses) }))
    .sort(
      (a, b) =>
        new Date(b.start_date ?? 0).getTime() -
        new Date(a.start_date ?? 0).getTime(),
    )
    .slice(0, 30);

  return (
    <div className="bg-app-gradient min-h-screen p-6">
      <div className="mx-auto max-w-3xl space-y-6 py-10">
        <div className="text-center">
          <Tv className="mx-auto size-10 text-primary" />
          <h1 className="mt-3 text-3xl font-bold">Live Monitor</h1>
          <p className="mt-1 text-muted-foreground">
            Pick an active tournament to show the TV board.
          </p>
        </div>

        {tournaments.length === 0 ? (
          <p className="glass rounded-2xl p-10 text-center text-muted-foreground">
            No active tournaments right now.
          </p>
        ) : (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <Link
                key={t.id}
                href={`/monitor?t=${t.short_code}`}
                className="glass flex items-center justify-between rounded-2xl p-4 transition-colors hover:bg-accent/40"
              >
                <span className="font-semibold">{t.name}</span>
                <TournamentStatusBadge status={t.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
