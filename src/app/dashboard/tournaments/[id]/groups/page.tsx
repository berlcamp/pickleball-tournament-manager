import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/page-header";
import {
  SeedingGroupsBoard,
  type BoardGroup,
} from "@/components/tournament/seeding-groups-board";
import { Lock, Users } from "lucide-react";

export default async function GroupsPage({
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

  const { data: participants } = await supabase
    .from("participants")
    .select("id, name, seed")
    .eq("category_id", active.id)
    .order("seed", { ascending: true });

  const { data: groupsRaw } = await supabase
    .from("groups")
    .select(
      "id, name, position, group_members(seed_in_group, participants(id, name))",
    )
    .eq("category_id", active.id)
    .order("position");

  const rows = (groupsRaw ?? []) as unknown as {
    id: string;
    name: string;
    position: number;
    group_members: {
      seed_in_group: number;
      participants: { id: string; name: string } | null;
    }[];
  }[];

  const groups: BoardGroup[] = rows.map((g) => ({
    id: g.id,
    name: g.name,
    members: (g.group_members ?? [])
      .filter((m) => m.participants)
      .map((m) => ({
        participantId: m.participants!.id,
        seed: m.seed_in_group,
        name: m.participants!.name,
      }))
      .sort((a, b) => a.seed - b.seed),
  }));

  const groupByParticipant = new Map<string, string>();
  for (const g of groups) {
    for (const m of g.members) groupByParticipant.set(m.participantId, g.id);
  }

  const teams = (participants ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    groupId: groupByParticipant.get(p.id) ?? null,
  }));

  const canEdit = roleAtLeast(ctx.role, "admin");
  const canGenerate = canEdit && active.status === "draft";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seeding & Groups"
        description="Set the seed order, then split the teams into groups."
      />

      {canEdit && !canGenerate && (
        <div className="glass flex items-center gap-2 rounded-2xl p-4 text-sm text-muted-foreground">
          <Lock className="size-4" />
          Group stage has started — seeding and groups are locked.
        </div>
      )}

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams to seed"
          description="Add teams first, then come back to seed them and draw the groups."
        />
      ) : (
        <SeedingGroupsBoard
          key={active.id}
          tournamentId={id}
          categoryId={active.id}
          teams={teams}
          groups={groups}
          canEdit={canGenerate}
        />
      )}
    </div>
  );
}
