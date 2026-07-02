import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { roleAtLeast } from "@/lib/constants";
import type { Role } from "@/types";
import type { Database } from "@/types/database";

export class ActionError extends Error {}

/**
 * Throw unless the category is still a draft. Once the group stage has started
 * (status is `group_stage` or later), participant/seeding/group changes are
 * locked to protect existing matches and standings.
 */
export async function assertCategoryDraft(
  supabase: SupabaseClient<Database>,
  categoryId: string,
) {
  const { data: category, error } = await supabase
    .from("categories")
    .select("status")
    .eq("id", categoryId)
    .single();
  if (error) throw new ActionError(error.message);
  if (!category) throw new ActionError("Category not found.");
  if (category.status !== "draft") {
    throw new ActionError(
      "The group stage has started. Participants, seeding, and groups can no longer be changed.",
    );
  }
}

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new ActionError("You must be signed in.");
  return { supabase, user };
}

/** Ensure the current user has at least `min` role on the tournament. */
export async function assertRole(tournamentId: string, min: Role) {
  const { supabase, user } = await getSessionUser();
  const { data } = await supabase
    .from("tournament_members")
    .select("role")
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (data?.role as Role) ?? null;
  if (!roleAtLeast(role, min)) {
    throw new ActionError("You don't have permission to do that.");
  }
  return { supabase, user, role: role as Role };
}

export async function logAudit(
  tournamentId: string,
  action: string,
  detail: Record<string, unknown> = {},
) {
  try {
    const { supabase, user } = await getSessionUser();
    await supabase.from("audit_logs").insert({
      tournament_id: tournamentId,
      user_id: user.id,
      action,
      detail,
    });
  } catch {
    // Audit logging must never break the primary action.
  }
}

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function run<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Something went wrong.";
    return { ok: false, error: message };
  }
}
