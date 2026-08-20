"use server";

import { revalidatePath } from "next/cache";
import {
  ActionError,
  assertCategoryDraft,
  assertRole,
  logAudit,
  run,
} from "./helpers";
import { assignGroups, groupLabel } from "@/services/seeding";
import { generateRoundRobin } from "@/services/roundRobin";

/**
 * Generate groups using Challonge-style pair-alternating distribution,
 * build round-robin matches for each
 * group, and initialise standings. Moves the category to group_stage.
 */
export async function generateGroups(
  tournamentId: string,
  categoryId: string,
  numGroups: number,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");
    await assertCategoryDraft(supabase, categoryId);

    const { data: participants, error: pErr } = await supabase
      .from("participants")
      .select("id, seed")
      .eq("category_id", categoryId)
      .order("seed", { ascending: true });
    if (pErr) throw new ActionError(pErr.message);
    if (!participants || participants.length < numGroups * 2) {
      throw new ActionError(
        "Add at least 2 teams per group before generating groups.",
      );
    }

    // Clear this category's previous group stage (cascades members, matches,
    // standings).
    await supabase.from("groups").delete().eq("category_id", categoryId);

    const seeded = participants.map((p, i) => ({
      id: p.id,
      seed: p.seed ?? i + 1,
    }));
    const assignments = assignGroups(seeded, numGroups);

    // Create groups.
    const groupRows = assignments.map((g) => ({
      tournament_id: tournamentId,
      category_id: categoryId,
      name: `Group ${groupLabel(g.groupIndex)}`,
      position: g.groupIndex,
    }));
    const { data: createdGroups, error: gErr } = await supabase
      .from("groups")
      .insert(groupRows)
      .select("id, position");
    if (gErr) throw new ActionError(gErr.message);

    const groupIdByPos = new Map<number, string>();
    (createdGroups ?? []).forEach((g) => groupIdByPos.set(g.position, g.id));

    const memberRows: {
      group_id: string;
      participant_id: string;
      seed_in_group: number;
    }[] = [];
    const matchRows: {
      tournament_id: string;
      category_id: string;
      group_id: string;
      participant1_id: string;
      participant2_id: string;
      round: number;
    }[] = [];
    const standingRows: {
      tournament_id: string;
      category_id: string;
      group_id: string;
      participant_id: string;
    }[] = [];

    for (const g of assignments) {
      const groupId = groupIdByPos.get(g.groupIndex)!;
      for (const m of g.members) {
        memberRows.push({
          group_id: groupId,
          participant_id: m.participantId,
          seed_in_group: m.seedInGroup,
        });
        standingRows.push({
          tournament_id: tournamentId,
          category_id: categoryId,
          group_id: groupId,
          participant_id: m.participantId,
        });
      }
      const rr = generateRoundRobin(g.members.map((m) => m.participantId));
      for (const match of rr) {
        if (!match.participant1Id || !match.participant2Id) continue;
        matchRows.push({
          tournament_id: tournamentId,
          category_id: categoryId,
          group_id: groupId,
          participant1_id: match.participant1Id,
          participant2_id: match.participant2Id,
          round: match.round,
        });
      }
    }

    if (memberRows.length) {
      const { error } = await supabase.from("group_members").insert(memberRows);
      if (error) throw new ActionError(error.message);
    }
    if (standingRows.length) {
      const { error } = await supabase.from("standings").insert(standingRows);
      if (error) throw new ActionError(error.message);
    }
    if (matchRows.length) {
      const { error } = await supabase.from("group_matches").insert(matchRows);
      if (error) throw new ActionError(error.message);
    }

    await logAudit(tournamentId, "groups.generate", { categoryId, numGroups });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
    return numGroups;
  });
}

/**
 * Delete all groups for a category (cascades members, matches, and
 * standings). Only allowed while the category is still a draft, i.e. before
 * the group stage has started.
 */
export async function clearGroups(tournamentId: string, categoryId: string) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");
    await assertCategoryDraft(supabase, categoryId);

    // match_schedules.match_id has no FK to group_matches, so it isn't
    // covered by the groups delete cascade below — drop group schedule
    // entries explicitly to avoid leaving orphaned rows.
    await supabase
      .from("match_schedules")
      .delete()
      .eq("category_id", categoryId)
      .eq("match_type", "group");

    const { error } = await supabase
      .from("groups")
      .delete()
      .eq("category_id", categoryId);
    if (error) throw new ActionError(error.message);

    await logAudit(tournamentId, "groups.clear", { categoryId });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
  });
}
