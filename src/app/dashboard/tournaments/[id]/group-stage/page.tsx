import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { loadGroupStage } from "@/lib/tournament-data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/page-header";
import { GroupStageView } from "@/components/tournament/group-stage-view";
import { Button } from "@/components/ui/button";
import { Network } from "lucide-react";

export default async function GroupStagePage({
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
  const groups = await loadGroupStage(supabase, active.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Group Stage"
        description="Enter match scores — standings update automatically."
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No groups yet"
          description="Generate groups first to start the round robin."
        >
          <Button asChild>
            <Link href={`/dashboard/tournaments/${id}/groups`}>
              Go to Groups
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <GroupStageView
          tournamentId={id}
          groups={groups}
          canScore={roleAtLeast(ctx.role, "scorekeeper")}
        />
      )}
    </div>
  );
}
