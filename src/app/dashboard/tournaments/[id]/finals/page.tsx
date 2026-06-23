import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { loadFinals } from "@/lib/tournament-data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/page-header";
import { FinalsGenerator } from "@/components/tournament/finals-generator";
import { BracketView } from "@/components/tournament/bracket-view";
import { Podium } from "@/components/tournament/podium";
import { Network } from "lucide-react";

export default async function FinalsPage({
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
  const { rounds, placements } = await loadFinals(supabase, active.id);
  const canEdit = roleAtLeast(ctx.role, "admin");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finals"
        description="Knockout bracket and championship results."
      />

      <Podium placements={placements} />

      {canEdit && (
        <FinalsGenerator
          tournamentId={id}
          categoryId={active.id}
          hasBracket={rounds.length > 0}
          bracketType={active.final_bracket_type}
        />
      )}

      {rounds.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No bracket yet"
          description="Finish the group stage, then generate the finals bracket."
        />
      ) : (
        <BracketView
          tournamentId={id}
          rounds={rounds}
          canScore={roleAtLeast(ctx.role, "scorekeeper")}
        />
      )}
    </div>
  );
}
