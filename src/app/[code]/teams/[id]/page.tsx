import { notFound } from "next/navigation";
import Link from "next/link";
import { getTournamentByPublicRef, publicClient } from "@/lib/data";
import {
  loadGroupStage,
  loadSchedule,
  loadFinals,
} from "@/lib/tournament-data";
import { MatchStatusBadge, WLBadge } from "@/components/status-badge";
import { formatTime } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicTeamPage({
  params,
}: {
  params: Promise<{ code: string; id: string }>;
}) {
  const { code, id } = await params;
  const tournament = await getTournamentByPublicRef(code);
  if (!tournament) notFound();

  const db = await publicClient();
  const { data: participant } = await db
    .from("participants")
    .select("name, category_id")
    .eq("id", id)
    .maybeSingle();
  if (!participant) notFound();

  const [groups, schedule, finals] = await Promise.all([
    loadGroupStage(db, participant.category_id),
    loadSchedule(db, tournament.id, participant.category_id),
    loadFinals(db, participant.category_id),
  ]);

  const group = groups.find((g) =>
    g.matches.some((m) => m.team1.id === id || m.team2.id === id),
  );
  const standing = group?.standings.find((s) => s.participantId === id);
  const teamMatches =
    group?.matches.filter((m) => m.team1.id === id || m.team2.id === id) ?? [];
  const mySchedule = schedule.filter(
    (r) => r.team1 === participant.name || r.team2 === participant.name,
  );
  const finalMatches = finals.rounds
    .flatMap((r) => r.matches)
    .filter((m) => m.team1.id === id || m.team2.id === id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/${code}/standings`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to standings
        </Link>
        <h2 className="text-2xl font-bold">{participant.name}</h2>
        {group && (
          <p className="text-sm text-muted-foreground">{group.name}</p>
        )}
      </div>

      {standing && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "Rank", v: `#${standing.rank}` },
            {
              l: "Record",
              v: `${standing.matchesWon}-${standing.matchesLost}-${standing.matchesTied}`,
            },
            { l: "Set Wins", v: standing.setWins },
            { l: "Points", v: standing.points },
          ].map((s) => (
            <div key={s.l} className="glass rounded-2xl p-4 text-center">
              <div className="text-xs text-muted-foreground">{s.l}</div>
              <div className="mt-1 text-xl font-bold">{s.v}</div>
            </div>
          ))}
        </div>
      )}

      {mySchedule.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Schedule</h3>
          <div className="glass divide-y divide-border/50 rounded-2xl">
            {mySchedule.map((r) => {
              const opp = r.team1 === participant.name ? r.team2 : r.team1;
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-medium">
                      {formatTime(r.time)}
                    </span>
                    <span className="text-muted-foreground">{r.court}</span>
                  </div>
                  <span className="flex-1 truncate text-center">vs {opp}</span>
                  <MatchStatusBadge status={r.status} />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {teamMatches.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Group results</h3>
          <div className="glass divide-y divide-border/50 rounded-2xl">
            {teamMatches.map((m) => {
              const isT1 = m.team1.id === id;
              const opp = isT1 ? m.team2.name : m.team1.name;
              const result =
                m.status !== "completed"
                  ? null
                  : m.winnerId === id
                    ? "W"
                    : m.winnerId
                      ? "L"
                      : "T";
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  {result ? <WLBadge result={result} /> : <span className="w-6" />}
                  <span className="flex-1 truncate">vs {opp}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {m.sets
                      .map(
                        (s) =>
                          `${s.participant1_score}-${s.participant2_score}`,
                      )
                      .join(", ") || "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {finalMatches.length > 0 && (
        <section className="space-y-2">
          <h3 className="font-semibold">Finals</h3>
          <div className="glass divide-y divide-border/50 rounded-2xl">
            {finalMatches.map((m) => {
              const opp = m.team1.id === id ? m.team2.name : m.team1.name;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <span className="text-xs uppercase text-muted-foreground">
                    {m.label}
                  </span>
                  <span className="flex-1 truncate text-center">vs {opp}</span>
                  <MatchStatusBadge status={m.status} />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
