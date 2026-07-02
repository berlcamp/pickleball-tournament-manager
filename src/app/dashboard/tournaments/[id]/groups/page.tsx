import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { GroupGenerator } from "@/components/tournament/group-generator";
import { Users, Lock } from "lucide-react";

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

  const { count: participantCount } = await supabase
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("category_id", active.id);

  const { data: groupsRaw } = await supabase
    .from("groups")
    .select(
      "id, name, position, group_members(seed_in_group, participants(name))",
    )
    .eq("category_id", active.id)
    .order("position");

  const groups = (groupsRaw ?? []) as unknown as {
    id: string;
    name: string;
    position: number;
    group_members: {
      seed_in_group: number;
      participants: { name: string } | null;
    }[];
  }[];

  const canEdit = roleAtLeast(ctx.role, "admin");
  const canGenerate = canEdit && active.status === "draft";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groups"
        description="Snake-seeded round robin groups."
      />

      {canGenerate && (
        <GroupGenerator
          tournamentId={id}
          categoryId={active.id}
          participantCount={participantCount ?? 0}
          hasGroups={(groups?.length ?? 0) > 0}
        />
      )}

      {canEdit && !canGenerate && (
        <div className="glass flex items-center gap-2 rounded-2xl p-4 text-sm text-muted-foreground">
          <Lock className="size-4" />
          Group stage has started — groups are locked.
        </div>
      )}

      {groups && groups.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const members = (g.group_members ?? [])
              .map((m) => ({
                seed: m.seed_in_group,
                name:
                  (m.participants as unknown as { name: string } | null)?.name ??
                  "—",
              }))
              .sort((a, b) => a.seed - b.seed);
            return (
              <div key={g.id} className="glass rounded-2xl p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">{g.name}</h3>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3.5" /> {members.length}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {members.map((m) => (
                    <li
                      key={m.seed}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="grid size-5 place-items-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                        {m.seed}
                      </span>
                      {m.name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
