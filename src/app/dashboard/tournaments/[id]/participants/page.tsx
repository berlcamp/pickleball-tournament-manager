import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { ParticipantsManager } from "@/components/tournament/participants-manager";
import type { Participant } from "@/types";

export default async function ParticipantsPage({
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        description={`${data?.length ?? 0} teams in ${active.name}. Add individually or bulk import.`}
      />
      <ParticipantsManager
        tournamentId={id}
        categoryId={active.id}
        participants={(data ?? []) as Participant[]}
        canEdit={roleAtLeast(ctx.role, "admin") && active.status === "draft"}
        canRename={roleAtLeast(ctx.role, "admin")}
      />
    </div>
  );
}
