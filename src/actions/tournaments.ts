"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/format";
import {
  tournamentSchema,
  createTournamentSchema,
  categorySchema,
  profileSchema,
} from "@/validators";
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

    const { data, error } = await supabase
      .from("tournaments")
      .insert({
        name: parsed.name,
        description: parsed.description || null,
        location: parsed.location || null,
        start_date: parsed.start_date || null,
        banner: parsed.banner || null,
        slug,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) throw new ActionError(error.message);

    // Create the tournament's categories (sub-tournaments).
    const categoryRows = parsed.categories.map((c, i) => ({
      tournament_id: data.id,
      name: c.name,
      position: i,
      final_bracket_type: c.final_bracket_type,
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
      })
      .eq("id", id);
    if (error) throw new ActionError(error.message);
    await logAudit(id, "tournament.update", {});
    revalidatePath(`/dashboard/tournaments/${id}`);
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
        final_bracket_type: parsed.final_bracket_type,
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
    const { error } = await supabase
      .from("categories")
      .update({
        name: parsed.name,
        final_bracket_type: parsed.final_bracket_type,
      })
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

export async function deleteTournament(id: string) {
  const result = await run(async () => {
    const { supabase } = await assertRole(id, "owner");
    const { error } = await supabase.from("tournaments").delete().eq("id", id);
    if (error) throw new ActionError(error.message);
  });
  if (result.ok) {
    revalidatePath("/dashboard/tournaments");
    redirect("/dashboard/tournaments");
  }
  return result;
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
