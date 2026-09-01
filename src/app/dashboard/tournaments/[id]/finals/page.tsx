import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { loadFinals, loadFinalsPreview } from "@/lib/tournament-data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/page-header";
import { BracketView } from "@/components/tournament/bracket-view";
import { Podium } from "@/components/tournament/podium";
import { Eye, Network } from "lucide-react";

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

  // Before the group stage ends there is no real bracket yet — show the draw
  // the groups will feed, with a placeholder in every slot.
  const preview = rounds.length === 0 ? await loadFinalsPreview(supabase, active.id) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finals"
        description="Knockout bracket and championship results."
      />

      <Podium placements={placements} />

      {rounds.length > 0 ? (
        <BracketView
          tournamentId={id}
          rounds={rounds}
          canScore={roleAtLeast(ctx.role, "scorekeeper")}
        />
      ) : preview.length > 0 ? (
        <div className="space-y-4">
          <div className="glass flex items-start gap-2 rounded-2xl p-4 text-sm text-muted-foreground">
            <Eye className="mt-0.5 size-4 shrink-0" />
            <span>
              Preview only — every slot shows the group and finishing position
              that will fill it, and the draw shifts as the standings move. The
              bracket that counts is drawn when the group stage ends.
            </span>
          </div>
          <BracketView tournamentId={id} rounds={preview} canScore={false} />
        </div>
      ) : (
        <EmptyState
          icon={Network}
          title="No bracket yet"
          description="Generate this category's groups — the finals bracket is drawn from them."
        />
      )}
    </div>
  );
}
