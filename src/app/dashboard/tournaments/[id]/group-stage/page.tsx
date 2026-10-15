import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { loadGroupStage, loadSeedingSnapshot } from "@/lib/tournament-data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/page-header";
import { GroupStageView } from "@/components/tournament/group-stage-view";
import { FinalsSeedingDialog } from "@/components/tournament/finals-seeding-dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight, Network } from "lucide-react";

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
  const [groups, seeding] = await Promise.all([
    loadGroupStage(supabase, active.id),
    loadSeedingSnapshot(supabase, active.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Group Stage"
        description="Tap a match to enter its score — standings update on their own."
      >
        {seeding && (
          <FinalsSeedingDialog
            snapshot={seeding}
            locked={active.status === "final_stage" || active.status === "completed"}
          />
        )}
      </PageHeader>
      {groups.length === 0 ? (
        <EmptyState
          icon={Network}
          title="No groups yet"
          description="The round robin is built from the groups. Draw them on the Seeding & Groups tab, and the matches appear here."
        >
          <Button asChild>
            <Link href={`/dashboard/tournaments/${id}/groups?category=${active.id}`}>
              Go to Seeding & Groups <ArrowRight className="size-4" />
            </Link>
          </Button>
        </EmptyState>
      ) : (
        <GroupStageView
          key={active.id}
          tournamentId={id}
          categoryId={active.id}
          groups={groups}
          status={active.status}
          canManage={roleAtLeast(ctx.role, "admin")}
          canScore={
            roleAtLeast(ctx.role, "scorekeeper") &&
            active.status === "group_stage"
          }
        />
      )}
    </div>
  );
}
