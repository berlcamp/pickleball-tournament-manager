import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/page-header";
import { SeedingBoard } from "@/components/tournament/seeding-board";
import { Users } from "lucide-react";
import type { Participant } from "@/types";

export default async function SeedingPage({
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
  const { data } = await supabase
    .from("participants")
    .select("*")
    .eq("category_id", active.id)
    .order("seed", { ascending: true });
  const participants = (data ?? []) as Participant[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Seeding"
        description="Drag teams to set seeds, or randomize with an animated shuffle."
      />
      {participants.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams to seed"
          description="Add teams first, then come back to set the seeding order."
        />
      ) : (
        <SeedingBoard
          tournamentId={id}
          categoryId={active.id}
          participants={participants}
          canEdit={roleAtLeast(ctx.role, "admin") && active.status === "draft"}
        />
      )}
    </div>
  );
}
