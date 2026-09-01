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

/**
 * Rebuild the round-robin matches and standings of a single group from its
 * current members. Used after a manual assignment moves a team in or out.
 * Safe only while the category is a draft — it drops the group's matches,
 * which by then carry no scores.
 */
async function rebuildGroup(
  supabase: Awaited<ReturnType<typeof assertRole>>["supabase"],
  tournamentId: string,
  categoryId: string,
  groupId: string,
) {
  const { data: existing, error: mErr } = await supabase
    .from("group_matches")
    .select("id")
    .eq("group_id", groupId);
  if (mErr) throw new ActionError(mErr.message);

  const matchIds = (existing ?? []).map((m) => m.id);
  if (matchIds.length) {
    // match_schedules.match_id has no FK, so it isn't cascaded — clear the
    // slots of the matches we're about to delete.
    await supabase
      .from("match_schedules")
      .delete()
      .eq("match_type", "group")
      .in("match_id", matchIds);
  }

  await supabase.from("group_matches").delete().eq("group_id", groupId);
  await supabase.from("standings").delete().eq("group_id", groupId);

  const { data: members, error: memErr } = await supabase
    .from("group_members")
    .select("participant_id, seed_in_group")
    .eq("group_id", groupId)
    .order("seed_in_group", { ascending: true });
  if (memErr) throw new ActionError(memErr.message);

  const participantIds = (members ?? []).map((m) => m.participant_id);
  if (!participantIds.length) return;

  const { error: sErr } = await supabase.from("standings").insert(
    participantIds.map((participantId) => ({
      tournament_id: tournamentId,
      category_id: categoryId,
      group_id: groupId,
      participant_id: participantId,
    })),
  );
  if (sErr) throw new ActionError(sErr.message);

  const matchRows = generateRoundRobin(participantIds)
    .filter((m) => m.participant1Id && m.participant2Id)
    .map((m) => ({
      tournament_id: tournamentId,
      category_id: categoryId,
      group_id: groupId,
      participant1_id: m.participant1Id!,
      participant2_id: m.participant2Id!,
      round: m.round,
    }));
  if (matchRows.length) {
    const { error } = await supabase.from("group_matches").insert(matchRows);
    if (error) throw new ActionError(error.message);
  }
}

/**
 * Move one team into a group by hand (or out of every group when `groupId` is
 * null). The groups it leaves and the one it joins both get their round-robin
 * matches and standings rebuilt.
 */
export async function assignParticipantToGroup(
  tournamentId: string,
  categoryId: string,
  participantId: string,
  groupId: string | null,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");
    await assertCategoryDraft(supabase, categoryId);

    const { data: participant, error: pErr } = await supabase
      .from("participants")
      .select("id")
      .eq("id", participantId)
      .eq("category_id", categoryId)
      .maybeSingle();
    if (pErr) throw new ActionError(pErr.message);
    if (!participant) throw new ActionError("Team not found in this category.");

    const { data: categoryGroups, error: gErr } = await supabase
      .from("groups")
      .select("id")
      .eq("category_id", categoryId);
    if (gErr) throw new ActionError(gErr.message);
    const groupIds = (categoryGroups ?? []).map((g) => g.id);

    if (groupId && !groupIds.includes(groupId)) {
      throw new ActionError("Group not found in this category.");
    }

    const { data: current, error: cErr } = await supabase
      .from("group_members")
      .select("id, group_id")
      .eq("participant_id", participantId)
      .in("group_id", groupIds.length ? groupIds : ["00000000-0000-0000-0000-000000000000"]);
    if (cErr) throw new ActionError(cErr.message);

    const from = (current ?? []).map((m) => m.group_id);
    if (from.length === 1 && from[0] === groupId) return;

    if (current?.length) {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .in(
          "id",
          current.map((m) => m.id),
        );
      if (error) throw new ActionError(error.message);
    }

    if (groupId) {
      const { data: seats, error: seatErr } = await supabase
        .from("group_members")
        .select("seed_in_group")
        .eq("group_id", groupId)
        .order("seed_in_group", { ascending: false })
        .limit(1);
      if (seatErr) throw new ActionError(seatErr.message);
      const nextSeed = (seats?.[0]?.seed_in_group ?? 0) + 1;

      const { error } = await supabase.from("group_members").insert({
        group_id: groupId,
        participant_id: participantId,
        seed_in_group: nextSeed,
      });
      if (error) throw new ActionError(error.message);
    }

    // Close the gap the team left behind so seeds stay 1..n.
    for (const oldGroupId of from) {
      const { data: rest } = await supabase
        .from("group_members")
        .select("id, seed_in_group")
        .eq("group_id", oldGroupId)
        .order("seed_in_group", { ascending: true });
      let seed = 1;
      for (const m of rest ?? []) {
        if (m.seed_in_group !== seed) {
          await supabase
            .from("group_members")
            .update({ seed_in_group: seed })
            .eq("id", m.id);
        }
        seed += 1;
      }
    }

    const touched = new Set([...from, ...(groupId ? [groupId] : [])]);
    for (const id of touched) {
      await rebuildGroup(supabase, tournamentId, categoryId, id);
    }

    await logAudit(tournamentId, "groups.assign", {
      categoryId,
      participantId,
      groupId,
    });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
  });
}

/** Add one empty group to a category, so teams can be placed by hand. */
export async function addGroup(tournamentId: string, categoryId: string) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");
    await assertCategoryDraft(supabase, categoryId);

    const { data: last, error: gErr } = await supabase
      .from("groups")
      .select("position")
      .eq("category_id", categoryId)
      .order("position", { ascending: false })
      .limit(1);
    if (gErr) throw new ActionError(gErr.message);
    const position = (last?.[0]?.position ?? -1) + 1;

    const { error } = await supabase.from("groups").insert({
      tournament_id: tournamentId,
      category_id: categoryId,
      name: `Group ${groupLabel(position)}`,
      position,
    });
    if (error) throw new ActionError(error.message);

    await logAudit(tournamentId, "groups.add", { categoryId, position });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
  });
}
