import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/types";

/**
 * The signed-in user, verified against Supabase Auth once per request.
 *
 * `auth.getUser()` is a network round trip. A dashboard render used to make
 * three or four of them (layout, profile, tournament context, page), so every
 * caller now shares this memoized one.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return data ?? null;
});

/** Resolve the current user's role for a tournament (null if not a member). */
export async function getTournamentRole(
  tournamentId: string,
): Promise<Role | null> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("tournament_members")
    .select("role")
    .eq("tournament_id", tournamentId)
    .eq("user_id", user.id)
    .maybeSingle();
  return (data?.role as Role) ?? null;
}
