import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { loadGroupStage, loadFinals } from "@/lib/tournament-data";
import { PageHeader, EmptyState } from "@/components/page-header";
import { StandingsTable } from "@/components/tournament/standings-table";
import { BracketView } from "@/components/tournament/bracket-view";
import { Podium } from "@/components/tournament/podium";
import { QrShare } from "@/components/qr-share";
import { Trophy } from "lucide-react";

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
      <PageHeader title="Results" description="Final standings and bracket.">
        <QrShare
          path={`/tournament/${ctx.tournament.slug}/standings?category=${active.id}`}
          label="Share results"
        />
      </PageHeader>

      {empty ? (
        <EmptyState
          icon={Trophy}
          title="No results yet"
          description="Results appear here as matches are played."
        />
      ) : (
        <>
          <Podium placements={finals.placements} />

          {finals.rounds.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Finals bracket</h2>
              <BracketView
                tournamentId={id}
                rounds={finals.rounds}
                canScore={false}
              />
            </section>
          )}

          {groups.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold">Group standings</h2>
              {groups.map((g) => (
                <div key={g.id} className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    {g.name}
                  </h3>
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
