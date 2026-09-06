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
  const participants = (data ?? []) as Participant[];

  // How many approved registrations have no team here yet. Ids and status
  // only — no registrant PII on this tab.
  const { data: regs } = await supabase
    .from("registrations")
    .select("id, status, participant_id")
    .eq("category_id", active.id);
  const participantIds = new Set(participants.map((p) => p.id));
  const importable = (regs ?? []).filter(
    (r) =>
      r.status === "approved" &&
      (!r.participant_id || !participantIds.has(r.participant_id)),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teams"
        description={`${participants.length} teams in ${active.name}. Add individually, in bulk, or from the approved registrations.`}
      />
      <ParticipantsManager
        tournamentId={id}
        categoryId={active.id}
        participants={participants}
        importableCount={importable}
        canEdit={roleAtLeast(ctx.role, "admin") && active.status === "draft"}
        canRename={roleAtLeast(ctx.role, "admin")}
      />
    </div>
  );
}
