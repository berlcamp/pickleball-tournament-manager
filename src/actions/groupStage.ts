"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  ActionError,
  assertRole,
  getSessionUser,
  logAudit,
  run,
} from "./helpers";
import { scoreSchema } from "@/validators";
import {
  computeGroupStandings,
  type ScoredMatch,
} from "@/services/standings";
import { ADVANCE_PER_GROUP } from "@/lib/constants";

type DB = SupabaseClient<Database>;

function winnerFromSets(
  sets: { participant1_score: number; participant2_score: number }[],
) {
  let p1 = 0;
  let p2 = 0;
  for (const s of sets) {
    if (s.participant1_score > s.participant2_score) p1++;
    else if (s.participant2_score > s.participant1_score) p2++;
  }
  return { p1Sets: p1, p2Sets: p2 };
}

/**
 * Recompute and persist standings for one group.
 *
 * Two round trips: the group's members and its matches (scores embedded) are
 * read together, then every standings row is written in parallel. It reads
 * *after* the caller's write, so two courts saving into the same group at once
 * still end on standings that include both results.
 */
async function recomputeGroup(db: DB, tournamentId: string, groupId: string) {
  const [{ data: members }, { data: matchRows }] = await Promise.all([
    db.from("group_members").select("participant_id").eq("group_id", groupId),
    db
      .from("group_matches")
      .select(
        "id, participant1_id, participant2_id, status, group_match_scores(set_number, participant1_score, participant2_score)",
      )
      .eq("group_id", groupId),
  ]);
  const participantIds = (members ?? []).map((m) => m.participant_id);
  // Embedded selects aren't typed (the schema declares no relationships).
  const matches = (matchRows ?? []) as unknown as {
    id: string;
    participant1_id: string | null;
    participant2_id: string | null;
    status: string;
    group_match_scores: {
      set_number: number;
      participant1_score: number;
      participant2_score: number;
    }[];
  }[];
  const scoresByMatch = new Map(
    matches.map((m) => [
      m.id,
      [...(m.group_match_scores ?? [])].sort(
        (a, b) => a.set_number - b.set_number,
      ),
    ]),
  );

  const scored: ScoredMatch[] = matches
    .filter((m) => m.participant1_id && m.participant2_id)
    .map((m) => ({
      participant1Id: m.participant1_id!,
      participant2Id: m.participant2_id!,
      sets: scoresByMatch.get(m.id) ?? [],
      completed: m.status === "completed",
    }));

  const computed = computeGroupStandings(participantIds, scored, {
    advanceCount: ADVANCE_PER_GROUP,
  });

  await Promise.all(
    computed.map((c) =>
      db
        .from("standings")
        .update({
          rank: c.rank,
          status: c.status,
          matches_won: c.matchesWon,
          matches_lost: c.matchesLost,
          matches_tied: c.matchesTied,
          tie_break: c.tieBreak,
          set_wins: c.setWins,
          set_ties: c.setTies,
          points: c.points,
          point_diff: c.pointDiff,
          history: c.history,
        })
        .eq("group_id", groupId)
        .eq("participant_id", c.participantId),
    ),
  );
}

/** Throw unless the category is currently in the group stage. */
async function assertGroupStageActive(db: DB, categoryId: string) {
  const { data: category } = await db
    .from("categories")
    .select("status")
    .eq("id", categoryId)
    .single();
  if (!category) throw new ActionError("Category not found.");
  if (category.status !== "group_stage") {
    throw new ActionError("Group stage is not active.");
  }
}

export async function startGroupStage(
  tournamentId: string,
  categoryId: string,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");

    const { data: category } = await supabase
      .from("categories")
      .select("status")
      .eq("id", categoryId)
      .single();
    if (!category) throw new ActionError("Category not found.");
    if (category.status !== "draft") {
      throw new ActionError("Group stage has already started.");
    }

    const { data: matches } = await supabase
      .from("group_matches")
      .select("id")
      .eq("category_id", categoryId)
      .limit(1);
    if (!matches || matches.length === 0) {
      throw new ActionError("Generate groups first.");
    }

    await supabase
      .from("categories")
      .update({ status: "group_stage" })
      .eq("id", categoryId);

    await logAudit(tournamentId, "groupStage.start", { categoryId });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
  });
}

/**
 * Send a category back to `draft` after its group stage has started.
 *
 * The stage otherwise only moves forward, so this is the escape hatch for a
 * stage that was started by mistake. It is refused as soon as a single score
 * has been recorded: the matches, groups and schedule are kept untouched, and
 * reopening is only ever a status flip, never a wipe. Once the finals are
 * drawn it is refused too — the bracket is built from these standings.
 */
export async function reopenGroupStage(
  tournamentId: string,
  categoryId: string,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");

    const { data: category } = await supabase
      .from("categories")
      .select("status")
      .eq("id", categoryId)
      .single();
    if (!category) throw new ActionError("Category not found.");
    if (category.status === "draft") {
      throw new ActionError("This category is already a draft.");
    }
    if (category.status !== "group_stage") {
      throw new ActionError(
        "The finals have already been drawn. A category can only be reopened while its group stage is running.",
      );
    }

    const { data: matches, error: mErr } = await supabase
      .from("group_matches")
      .select("id")
      .eq("category_id", categoryId);
    if (mErr) throw new ActionError(mErr.message);
    const matchIds = (matches ?? []).map((m) => m.id);

    if (matchIds.length) {
      const { count, error: sErr } = await supabase
        .from("group_match_scores")
        .select("match_id", { count: "exact", head: true })
        .in("match_id", matchIds);
      if (sErr) throw new ActionError(sErr.message);
      if ((count ?? 0) > 0) {
        throw new ActionError(
          "Scores have already been recorded. Clear every match score first, then reopen the category.",
        );
      }
    }

    const { error } = await supabase
      .from("categories")
      .update({ status: "draft" })
      .eq("id", categoryId);
    if (error) throw new ActionError(error.message);

    await logAudit(tournamentId, "groupStage.reopen", { categoryId });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
  });
}

export async function submitGroupScore(
  tournamentId: string,
  matchId: string,
  sets: unknown,
) {
  return run(async () => {
    const parsed = scoreSchema.parse({ sets });
    const { supabase } = await getSessionUser();

    // The permission check and the match lookup (with its category's stage)
    // are independent reads, so they share one round trip. Nothing is
    // written until both have passed.
    const [, { data: matchRow, error: mErr }] = await Promise.all([
      assertRole(tournamentId, "scorekeeper"),
      supabase
        .from("group_matches")
        .select(
          "id, group_id, category_id, participant1_id, participant2_id, categories(status)",
        )
        .eq("id", matchId)
        .eq("tournament_id", tournamentId)
        .single(),
    ]);
    const match = matchRow as unknown as {
      group_id: string;
      participant1_id: string | null;
      participant2_id: string | null;
      categories: { status: string } | null;
    } | null;
    if (mErr || !match) throw new ActionError("Match not found.");
    if (match.categories?.status !== "group_stage") {
      throw new ActionError("Group stage is not active.");
    }

    const { p1Sets, p2Sets } = winnerFromSets(parsed.sets);
    const winnerId =
      p1Sets > p2Sets
        ? match.participant1_id
        : p2Sets > p1Sets
          ? match.participant2_id
          : null;

    // Overwrite the sets in place and drop any beyond the new count (an edit
    // that removed a set), alongside the match result — one round trip.
    const [{ error: sErr }, { error: dErr }, { error: uErr }] =
      await Promise.all([
        supabase.from("group_match_scores").upsert(
          parsed.sets.map((s, i) => ({
            match_id: matchId,
            set_number: i + 1,
            participant1_score: s.participant1_score,
            participant2_score: s.participant2_score,
          })),
          { onConflict: "match_id,set_number" },
        ),
        supabase
          .from("group_match_scores")
          .delete()
          .eq("match_id", matchId)
          .gt("set_number", parsed.sets.length),
        supabase
          .from("group_matches")
          .update({ status: "completed", winner_id: winnerId })
          .eq("id", matchId),
      ]);
    const writeErr = sErr ?? dErr ?? uErr;
    if (writeErr) throw new ActionError(writeErr.message);

    await recomputeGroup(supabase, tournamentId, match.group_id);
    await logAudit(tournamentId, "group.score", { matchId });
    revalidatePath(`/dashboard/tournaments/${tournamentId}/group-stage`);
  });
}

export async function clearGroupScore(
  tournamentId: string,
  matchId: string,
  groupId: string,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "scorekeeper");

    const { data: match, error: mErr } = await supabase
      .from("group_matches")
      .select("category_id")
      .eq("id", matchId)
      .single();
    if (mErr || !match) throw new ActionError("Match not found.");
    await assertGroupStageActive(supabase, match.category_id);

    await supabase.from("group_match_scores").delete().eq("match_id", matchId);
    await supabase
      .from("group_matches")
      .update({ status: "pending", winner_id: null })
      .eq("id", matchId);
    await recomputeGroup(supabase, tournamentId, groupId);
    revalidatePath(`/dashboard/tournaments/${tournamentId}/group-stage`);
  });
}
