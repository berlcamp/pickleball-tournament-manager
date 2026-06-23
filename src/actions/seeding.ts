"use server";

import { revalidatePath } from "next/cache";
import { ActionError, assertRole, logAudit, run } from "./helpers";
import { shuffle } from "@/services/seeding";

/** Persist a manual seed order (array of participant ids, best first). */
export async function saveSeeding(
  tournamentId: string,
  orderedIds: string[],
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");
    await Promise.all(
      orderedIds.map((id, i) =>
        supabase
          .from("participants")
          .update({ seed: i + 1 })
          .eq("id", id)
          .eq("tournament_id", tournamentId),
      ),
    );
    await logAudit(tournamentId, "seeding.save", { count: orderedIds.length });
    revalidatePath(`/dashboard/tournaments/${tournamentId}/seeding`);
  });
}

export async function randomizeSeeding(
  tournamentId: string,
  categoryId: string,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");
    const { data, error } = await supabase
      .from("participants")
      .select("id")
      .eq("category_id", categoryId);
    if (error) throw new ActionError(error.message);
    const ids = shuffle((data ?? []).map((d) => d.id));
    await Promise.all(
      ids.map((id, i) =>
        supabase.from("participants").update({ seed: i + 1 }).eq("id", id),
      ),
    );
    await logAudit(tournamentId, "seeding.randomize", {});
    revalidatePath(`/dashboard/tournaments/${tournamentId}/seeding`);
    return ids;
  });
}
