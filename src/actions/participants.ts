"use server";

import { revalidatePath } from "next/cache";
import {
  ActionError,
  assertCategoryDraft,
  assertRole,
  logAudit,
  run,
} from "./helpers";
import { participantSchema } from "@/validators";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/** Resolve a participant's category and ensure it's still a draft. */
async function assertParticipantDraft(
  supabase: SupabaseClient<Database>,
  participantId: string,
) {
  const { data: participant, error } = await supabase
    .from("participants")
    .select("category_id")
    .eq("id", participantId)
    .single();
  if (error) throw new ActionError(error.message);
  if (!participant) throw new ActionError("Team not found.");
  await assertCategoryDraft(supabase, participant.category_id);
}

export async function addParticipant(
  tournamentId: string,
  categoryId: string,
  name: string,
) {
  return run(async () => {
    const parsed = participantSchema.parse({ name });
    const { supabase } = await assertRole(tournamentId, "admin");
    await assertCategoryDraft(supabase, categoryId);

    const { count } = await supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId);

    const { error } = await supabase.from("participants").insert({
      tournament_id: tournamentId,
      category_id: categoryId,
      name: parsed.name,
      seed: (count ?? 0) + 1,
    });
    if (error) throw new ActionError(error.message);
    await logAudit(tournamentId, "participant.add", { name: parsed.name });
    revalidatePath(`/dashboard/tournaments/${tournamentId}/participants`);
  });
}

export async function bulkAddParticipants(
  tournamentId: string,
  categoryId: string,
  raw: string,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");
    await assertCategoryDraft(supabase, categoryId);
    const names = raw
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (names.length === 0) throw new ActionError("No teams found.");

    const { count } = await supabase
      .from("participants")
      .select("id", { count: "exact", head: true })
      .eq("category_id", categoryId);

    const base = count ?? 0;
    const rows = names.map((name, i) => ({
      tournament_id: tournamentId,
      category_id: categoryId,
      name,
      seed: base + i + 1,
    }));

    const { error } = await supabase.from("participants").insert(rows);
    if (error) throw new ActionError(error.message);
    await logAudit(tournamentId, "participant.bulk_add", {
      count: names.length,
    });
    revalidatePath(`/dashboard/tournaments/${tournamentId}/participants`);
    return names.length;
  });
}

export async function deleteParticipant(
  tournamentId: string,
  participantId: string,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");
    await assertParticipantDraft(supabase, participantId);
    const { error } = await supabase
      .from("participants")
      .delete()
      .eq("id", participantId);
    if (error) throw new ActionError(error.message);
    revalidatePath(`/dashboard/tournaments/${tournamentId}/participants`);
  });
}

export async function renameParticipant(
  tournamentId: string,
  participantId: string,
  name: string,
) {
  return run(async () => {
    const parsed = participantSchema.parse({ name });
    const { supabase } = await assertRole(tournamentId, "admin");
    await assertParticipantDraft(supabase, participantId);
    const { error } = await supabase
      .from("participants")
      .update({ name: parsed.name })
      .eq("id", participantId);
    if (error) throw new ActionError(error.message);
    await logAudit(tournamentId, "participant.rename", {
      participantId,
      name: parsed.name,
    });
    // The name shows up on the seeding board and the public team pages too.
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
  });
}
