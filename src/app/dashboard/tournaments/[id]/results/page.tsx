import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { loadGroupStage, loadFinals } from "@/lib/tournament-data";
import { PageHeader, EmptyState } from "@/components/page-header";
import { StandingsTable } from "@/components/tournament/standings-table";
import { BracketView } from "@/components/tournament/bracket-view";
import { Podium } from "@/components/tournament/podium";
import { QrShare } from "@/components/qr-share";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy } from "lucide-react";

export default async function ResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { id } = await params;
  const { category } = await searchParams;
  const ctx = await getTournamentContext(id);
  if (!ctx) notFound();
  const active = resolveActiveCategory(ctx.categories, category);
  if (!active) notFound();

  const supabase = await createClient();
  const [groups, finals] = await Promise.all([
    loadGroupStage(supabase, active.id),
    loadFinals(supabase, active.id),
  ]);

  const empty = groups.length === 0 && finals.rounds.length === 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Results"
        description="Podium, knockout bracket and every group's final table."
      >
        <QrShare
          path={`/${ctx.tournament.short_code}/standings?category=${active.id}`}
          label="Share results"
        />
      </PageHeader>

      {empty ? (
        <EmptyState
          icon={Trophy}
          title="No results yet"
          description="Results fill in as scores are entered. Draw the groups and start the group stage to get going."
        >
          <Button asChild variant="outline">
            <Link href={`/dashboard/tournaments/${id}/group-stage?category=${active.id}`}>
              Go to Group Stage <ArrowRight className="size-4" />
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <>
          <Podium placements={finals.placements} />

          {finals.rounds.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-2xl font-bold">Finals bracket</h2>
              <BracketView
                tournamentId={id}
                rounds={finals.rounds}
                canScore={false}
              />
            </section>
          )}

          {groups.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-2xl font-bold">Group standings</h2>
              {groups.map((g) => (
                <div key={g.id} className="space-y-2">
                  <h3 className="eyebrow">{g.name}</h3>
                  <StandingsTable rows={g.standings} />
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
