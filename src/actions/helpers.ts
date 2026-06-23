import "server-only";
import { createClient } from "@/lib/supabase/server";
import { roleAtLeast } from "@/lib/constants";
import type { Role } from "@/types";

export class ActionError extends Error {}

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
