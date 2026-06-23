"use server";

import { revalidatePath } from "next/cache";
import { ActionError, assertRole, logAudit, run } from "./helpers";
import { inviteSchema } from "@/validators";
import type { Role } from "@/types";

/**
 * Invite a Google account by email. If the user already has a profile we add
 * them directly; otherwise we store a pending invite that is auto-accepted
 * when they sign up (see DB trigger).
 */
export async function inviteMember(tournamentId: string, input: unknown) {
  return run(async () => {
    const parsed = inviteSchema.parse(input);
    const { supabase } = await assertRole(tournamentId, "admin");

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", parsed.email)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from("tournament_members").upsert(
        {
          tournament_id: tournamentId,
          user_id: existing.id,
          role: parsed.role,
        },
        { onConflict: "tournament_id,user_id" },
      );
      if (error) throw new ActionError(error.message);
    } else {
      const { error } = await supabase.from("tournament_invites").upsert(
        {
          tournament_id: tournamentId,
          email: parsed.email,
          role: parsed.role,
          invited_by: (await supabase.auth.getUser()).data.user?.id ?? null,
          status: "pending",
        },
        { onConflict: "tournament_id,email" },
      );
      if (error) throw new ActionError(error.message);
    }

    await logAudit(tournamentId, "member.invite", {
      email: parsed.email,
      role: parsed.role,
    });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
  });
}

export async function updateMemberRole(
  tournamentId: string,
  memberId: string,
  role: Role,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "owner");
    const { error } = await supabase
      .from("tournament_members")
      .update({ role })
      .eq("id", memberId)
      .eq("tournament_id", tournamentId);
    if (error) throw new ActionError(error.message);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
  });
}

export async function removeMember(tournamentId: string, memberId: string) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "owner");
    const { error } = await supabase
      .from("tournament_members")
      .delete()
      .eq("id", memberId)
      .eq("tournament_id", tournamentId);
    if (error) throw new ActionError(error.message);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
  });
}

export async function cancelInvite(tournamentId: string, inviteId: string) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");
    await supabase
      .from("tournament_invites")
      .delete()
      .eq("id", inviteId)
      .eq("tournament_id", tournamentId);
    revalidatePath(`/dashboard/tournaments/${tournamentId}`);
  });
}
