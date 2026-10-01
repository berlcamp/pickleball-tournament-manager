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

  // How many approved registrations have no team here yet. Names, ids and
  // status only — no other registrant PII on this tab.
  const { data: regs } = await supabase
    .from("registrations")
    .select("id, status, participant_id, team_name")
    .eq("category_id", active.id)
    .order("created_at", { ascending: true });
  const participantIds = new Set(participants.map((p) => p.id));
  const approved = (regs ?? []).filter((r) => r.status === "approved");
  const importable = approved.filter(
    (r) => !r.participant_id || !participantIds.has(r.participant_id),
  ).length;

  // Blind pairing: each registration is one player waiting for a partner.
  // Anyone whose name already sits in a team here has been drawn.
  const blindPairing = active.format === "blind_pairing";
  const drawn = new Set(
    participants.flatMap((p) =>
      p.name.split("/").map((n) => n.trim().toLowerCase()),
    ),
  );
  const unpairedPlayers = blindPairing
    ? approved
        .map((r) => r.team_name.trim())
        .filter((n) => n && !drawn.has(n.toLowerCase()))
    : [];

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
        blindPairing={blindPairing}
        unpairedPlayers={unpairedPlayers}
        canEdit={roleAtLeast(ctx.role, "admin") && active.status === "draft"}
        canRename={roleAtLeast(ctx.role, "admin")}
      />
    </div>
  );
}
