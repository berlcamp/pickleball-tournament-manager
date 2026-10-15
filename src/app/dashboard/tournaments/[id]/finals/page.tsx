import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import {
  loadFinals,
  loadFinalsPreview,
} from "@/lib/tournament-data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/page-header";
import { BracketView } from "@/components/tournament/bracket-view";
import { Podium } from "@/components/tournament/podium";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Eye, Network } from "lucide-react";

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
        description="The knockout bracket. Winners move into the next round as soon as a score is saved."
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
          <div className="glass flex items-start gap-3 rounded-2xl p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-chart-2/12 text-chart-2">
              <Eye className="size-4" />
            </span>
            <div className="text-sm">
              <p className="font-semibold">Preview — not the real draw yet</p>
              <p className="text-muted-foreground">
                Each slot shows the group and finishing place that will fill it
                (A1 is Group A&apos;s winner), and it shifts as the standings
                move. The bracket that counts is drawn when you end the group
                stage.
              </p>
            </div>
          </div>
          <BracketView tournamentId={id} rounds={preview} canScore={false} />
        </div>
      ) : (
        <EmptyState
          icon={Network}
          title="No bracket yet"
          description="The finals bracket is drawn from the groups. Draw this category's groups first, and a preview of the bracket appears here."
        >
          <Button asChild>
            <Link href={`/dashboard/tournaments/${id}/groups?category=${active.id}`}>
              Go to Seeding & Groups <ArrowRight className="size-4" />
            </Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
