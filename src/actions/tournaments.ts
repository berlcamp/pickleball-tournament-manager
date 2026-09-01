"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/format";
import {
  tournamentSchema,
  createTournamentSchema,
  categorySchema,
  profileSchema,
  shortCodeSchema,
} from "@/validators";
import { generateShortCode } from "@/lib/short-code";
import {
  ActionError,
  assertRole,
  getSessionUser,
  logAudit,
  run,
} from "./helpers";

export async function createTournament(input: unknown) {
  return run(async () => {
    const parsed = createTournamentSchema.parse(input);
    const { supabase, user } = await getSessionUser();

    const slug = `${slugify(parsed.name)}-${Math.random().toString(36).slice(2, 7)}`;

    // Claim a short code, retrying the (rare) collision. 31^5 keeps this to
    // effectively one attempt.
    let data: { id: string } | null = null;
    for (let attempt = 0; attempt < 5 && !data; attempt++) {
      const { data: row, error } = await supabase
        .from("tournaments")
        .insert({
          name: parsed.name,
          description: parsed.description || null,
          location: parsed.location || null,
          start_date: parsed.start_date || null,
          banner: parsed.banner || null,
          show_public_schedule: parsed.show_public_schedule,
          slug,
          short_code: generateShortCode(),
          created_by: user.id,
        })
        .select("id")
        .single();
      if (!error) {
        data = row;
        break;
      }
      if ((error as { code?: string }).code !== "23505") {
        throw new ActionError(error.message);
      }
    }
    if (!data) {
      throw new ActionError("Could not create the tournament. Please retry.");
    }

    // Create the tournament's categories (sub-tournaments).
    const categoryRows = parsed.categories.map((c, i) => ({
      tournament_id: data.id,
      name: c.name,
      position: i,
      event_date: c.event_date || null,
    }));
    const { error: cErr } = await supabase
      .from("categories")
      .insert(categoryRows);
    if (cErr) throw new ActionError(cErr.message);

    await logAudit(data.id, "tournament.create", {
      name: parsed.name,
      categories: parsed.categories.length,
    });
    revalidatePath("/dashboard/tournaments");
    return data.id;
  });
}

export async function updateTournament(id: string, input: unknown) {
  return run(async () => {
    const parsed = tournamentSchema.parse(input);
    const { supabase } = await assertRole(id, "admin");
    const { error } = await supabase
      .from("tournaments")
      .update({
        name: parsed.name,
        description: parsed.description || null,
        location: parsed.location || null,
        start_date: parsed.start_date || null,
        banner: parsed.banner || null,
        show_public_schedule: parsed.show_public_schedule,
      })
      .eq("id", id);
    if (error) throw new ActionError(error.message);
    await logAudit(id, "tournament.update", {});
    revalidatePath(`/dashboard/tournaments/${id}`);
    revalidatePath(`/tournament`, "layout");
  });
}

/**
 * Change the tournament's public link. The code lives at the domain root, so
 * uniqueness and the reserved-word list are both enforced here — the DB check
 * constraint only guards the shape.
 */
export async function updateShortCode(tournamentId: string, input: unknown) {
  return run(async () => {
    const parsed = shortCodeSchema.parse(input);
    const { supabase } = await assertRole(tournamentId, "admin");

    const { data: taken } = await supabase
      .from("tournaments")
      .select("id")
      .eq("short_code", parsed.short_code)
      .neq("id", tournamentId)
      .maybeSingle();
    if (taken) {
      throw new ActionError("That link is already taken. Try another.");
    }

    const { error } = await supabase
      .from("tournaments")
      .update({ short_code: parsed.short_code })
      .eq("id", tournamentId);
    if (error) {
      throw new ActionError(
        (error as { code?: string }).code === "23505"
          ? "That link is already taken. Try another."
          : error.message,
      );
    }

    await logAudit(tournamentId, "tournament.short_code", {
      short_code: parsed.short_code,
    });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
    return parsed.short_code;
  });
}

export async function createCategory(tournamentId: string, input: unknown) {
  return run(async () => {
    const parsed = categorySchema.parse(input);
    const { supabase } = await assertRole(tournamentId, "admin");

    const { count } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);

    const { data, error } = await supabase
      .from("categories")
      .insert({
        tournament_id: tournamentId,
        name: parsed.name,
        position: count ?? 0,
        event_date: parsed.event_date || null,
      })
      .select("id")
      .single();
    if (error) throw new ActionError(error.message);
    await logAudit(tournamentId, "category.create", { name: parsed.name });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
    return data.id;
  });
}

export async function updateCategory(
  tournamentId: string,
  categoryId: string,
  input: unknown,
) {
  return run(async () => {
    const parsed = categorySchema.parse(input);
    const { supabase } = await assertRole(tournamentId, "admin");

    const { data: category, error: fetchError } = await supabase
      .from("categories")
      .select("status, name")
      .eq("id", categoryId)
      .eq("tournament_id", tournamentId)
      .single();
    if (fetchError) throw new ActionError(fetchError.message);
    // A started category is locked structurally, but its date still has to be
    // correctable — play days slip, and the public page shows this date.
    if (category.status !== "draft" && parsed.name !== category.name) {
      throw new ActionError(
        "This category's group stage has started and can no longer be renamed.",
      );
    }

    const { error } = await supabase
      .from("categories")
      .update({ name: parsed.name, event_date: parsed.event_date || null })
      .eq("id", categoryId)
      .eq("tournament_id", tournamentId);
    if (error) throw new ActionError(error.message);
    await logAudit(tournamentId, "category.update", { categoryId });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
  });
}

export async function deleteCategory(tournamentId: string, categoryId: string) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");

    const { data: category, error: fetchError } = await supabase
      .from("categories")
      .select("status")
      .eq("id", categoryId)
      .eq("tournament_id", tournamentId)
      .single();
    if (fetchError) throw new ActionError(fetchError.message);
    if (category.status !== "draft") {
      throw new ActionError(
        "This category's group stage has started and can no longer be deleted.",
      );
    }

    const { count } = await supabase
      .from("categories")
      .select("id", { count: "exact", head: true })
      .eq("tournament_id", tournamentId);
    if ((count ?? 0) <= 1) {
      throw new ActionError("A tournament must have at least one category.");
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId)
      .eq("tournament_id", tournamentId);
    if (error) throw new ActionError(error.message);
    await logAudit(tournamentId, "category.delete", { categoryId });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
  });
}

export async function updateProfile(input: unknown) {
  return run(async () => {
    const parsed = profileSchema.parse(input);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new ActionError("Not signed in.");
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: parsed.full_name })
      .eq("id", user.id);
    if (error) throw new ActionError(error.message);
    revalidatePath("/dashboard/settings");
  });
}
