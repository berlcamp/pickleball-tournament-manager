import type { Metadata } from "next";
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
import { ArrowLeft, CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/public/empty-state";
import { portalMetadata } from "../../portal-metadata";

/**
 * A team's own page, titled with the team name — this is what someone
 * searching for their club or partner is most likely to land on.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string; id: string }>;
}): Promise<Metadata> {
  const { code, id } = await params;
  const db = await publicClient();
  const { data: participant } = await db
    .from("participants")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  if (!participant) return {};
  return portalMetadata(code, { path: `teams/${id}`, label: participant.name });
}

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
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href={`/${code}/standings`}
          className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back to standings
        </Link>
        <div>
          {group && <p className="eyebrow">{group.name}</p>}
          <h2 className="text-balance text-3xl font-bold uppercase leading-[0.95] sm:text-4xl">
            {participant.name}
          </h2>
        </div>
      </div>

      {standing && (
        <dl className="grid grid-cols-4 overflow-hidden rounded-2xl bg-court text-court-foreground shadow-card">
          {[
            { l: "Rank", v: `#${standing.rank}` },
            {
              l: "W-L-T",
              v: `${standing.matchesWon}-${standing.matchesLost}-${standing.matchesTied}`,
            },
            { l: "Sets", v: standing.setWins },
            { l: "Points", v: standing.points },
          ].map((s, i) => (
            <div
              key={s.l}
              className={`flex flex-col-reverse items-center px-1 py-4 text-center ${i > 0 ? "border-l border-court-foreground/15" : ""}`}
            >
              <dt className="font-heading text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-court-foreground/75 sm:text-xs">
                {s.l}
              </dt>
              <dd className="scoreboard text-2xl font-bold leading-none sm:text-4xl">
                {s.v}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {mySchedule.length > 0 && (
        <TeamSection title="Schedule">
          {mySchedule.map((r) => {
            const opp = r.team1 === participant.name ? r.team2 : r.team1;
            return (
              <li key={r.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="w-20 shrink-0">
                  <div className="scoreboard text-lg font-bold leading-none">
                    {formatTime(r.time)}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {r.court}
                  </div>
                </div>
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted-foreground">vs </span>
                  <span className="font-semibold">{opp}</span>
                </span>
                <MatchStatusBadge status={r.status} />
              </li>
            );
          })}
        </TeamSection>
      )}

      {teamMatches.length > 0 && (
        <TeamSection title="Group results">
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
              <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                {result ? (
                  <WLBadge result={result} />
                ) : (
                  <span className="w-6" aria-hidden />
                )}
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted-foreground">vs </span>
                  <span className="font-semibold">{opp}</span>
                </span>
                <span className="scoreboard shrink-0 text-base font-semibold">
                  {m.sets
                    .map((s) => {
                      const mine = isT1 ? s.participant1_score : s.participant2_score;
                      const theirs = isT1 ? s.participant2_score : s.participant1_score;
                      return `${mine}-${theirs}`;
                    })
                    .join(", ") || "—"}
                </span>
              </li>
            );
          })}
        </TeamSection>
      )}

      {finalMatches.length > 0 && (
        <TeamSection title="Finals">
          {finalMatches.map((m) => {
            const opp = m.team1.id === id ? m.team2.name : m.team1.name;
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="eyebrow w-20 shrink-0 truncate">{m.label}</span>
                <span className="min-w-0 flex-1 truncate">
                  <span className="text-muted-foreground">vs </span>
                  <span className="font-semibold">{opp}</span>
                </span>
                <MatchStatusBadge status={m.status} />
              </li>
            );
          })}
        </TeamSection>
      )}

      {!standing &&
        mySchedule.length === 0 &&
        teamMatches.length === 0 &&
        finalMatches.length === 0 && (
          <EmptyState icon={CalendarClock} title="No matches yet">
            This team&apos;s matches and results show up here once the groups
            are drawn.
          </EmptyState>
        )}
    </div>
  );
}

function TeamSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h3 className="font-heading text-lg font-bold uppercase tracking-wide">
        {title}
      </h3>
      <ul className="glass divide-y divide-border rounded-2xl">{children}</ul>
    </section>
  );
}
