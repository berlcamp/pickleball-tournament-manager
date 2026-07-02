"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ActionError, assertRole, logAudit, run } from "./helpers";
import { scoreSchema } from "@/validators";
import {
  generateFinalBracket,
  type QualifierSlot,
} from "@/services/brackets";
import { groupLabel } from "@/services/seeding";
import type { FinalBracketType, PlacementType } from "@/types";

type DB = SupabaseClient<Database>;
const ADVANCE_PER_GROUP = 2;

export async function generateFinals(
  tournamentId: string,
  categoryId: string,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");

    const { data: category } = await supabase
      .from("categories")
      .select("final_bracket_type, status")
      .eq("id", categoryId)
      .single();
    if (!category) throw new ActionError("Category not found.");
    if (category.status !== "group_stage") {
      throw new ActionError("Start the group stage before ending it.");
    }

    // Require all of this category's group matches to be complete.
    const { data: pending } = await supabase
      .from("group_matches")
      .select("id")
      .eq("category_id", categoryId)
      .neq("status", "completed")
      .limit(1);
    if (pending && pending.length > 0) {
      throw new ActionError(
        "Finish all group matches before generating finals.",
      );
    }

    const { data: groups } = await supabase
      .from("groups")
      .select("id, position")
      .eq("category_id", categoryId)
      .order("position");
    if (!groups || groups.length === 0) {
      throw new ActionError("Generate groups first.");
    }

    const { data: standings } = await supabase
      .from("standings")
      .select(
        "group_id, participant_id, rank, matches_won, points, point_diff",
      )
      .eq("category_id", categoryId);

    const posByGroup = new Map<string, number>();
    groups.forEach((g) => posByGroup.set(g.id, g.position));

    // Top N per group.
    const qualifiers: QualifierSlot[] = [];
    for (const g of groups) {
      const groupStandings = (standings ?? [])
        .filter((s) => s.group_id === g.id)
        .sort((a, b) => a.rank - b.rank)
        .slice(0, ADVANCE_PER_GROUP);
      groupStandings.forEach((s, i) => {
        qualifiers.push({
          label: `${groupLabel(g.position)}${i + 1}`,
          participantId: s.participant_id,
          groupIndex: g.position,
          position: i + 1,
          overallSeed: 0,
        });
      });
    }

    if (qualifiers.length < 2) {
      throw new ActionError("Not enough qualifiers for a bracket.");
    }

    // Overall seeding for standard_seed: group winners first, ranked by record.
    const byRecord = (a: QualifierSlot, b: QualifierSlot) => a.position - b.position;
    const sorted = [...qualifiers].sort(byRecord);
    sorted.forEach((q, i) => (q.overallSeed = i + 1));

    const bracket = generateFinalBracket(
      qualifiers,
      category.final_bracket_type as FinalBracketType,
    );

    // Reset this category's existing finals + placements.
    await supabase.from("final_matches").delete().eq("category_id", categoryId);
    await supabase.from("placements").delete().eq("category_id", categoryId);

    const rows = bracket.map((m) => ({
      tournament_id: tournamentId,
      category_id: categoryId,
      round: m.round,
      slot: m.slot,
      label: m.label,
      participant1_id: m.participant1Id,
      participant2_id: m.participant2Id,
      source1: m.source1,
      source2: m.source2,
    }));
    const { error } = await supabase.from("final_matches").insert(rows);
    if (error) throw new ActionError(error.message);

    await supabase
      .from("categories")
      .update({ status: "final_stage" })
      .eq("id", categoryId);

    await logAudit(tournamentId, "finals.generate", {
      categoryId,
      qualifiers: qualifiers.length,
    });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
    return bracket.length;
  });
}

function winnerLoser(
  sets: { participant1_score: number; participant2_score: number }[],
  p1: string | null,
  p2: string | null,
) {
  let a = 0;
  let b = 0;
  for (const s of sets) {
    if (s.participant1_score > s.participant2_score) a++;
    else if (s.participant2_score > s.participant1_score) b++;
  }
  if (a > b) return { winner: p1, loser: p2 };
  if (b > a) return { winner: p2, loser: p1 };
  return { winner: null, loser: null };
}

async function setPlacement(
  db: DB,
  tournamentId: string,
  categoryId: string,
  placement: PlacementType,
  participantId: string | null,
) {
  if (!participantId) return;
  await db
    .from("placements")
    .upsert(
      {
        tournament_id: tournamentId,
        category_id: categoryId,
        placement,
        participant_id: participantId,
      },
      { onConflict: "category_id,placement" },
    );
}

export async function submitFinalScore(
  tournamentId: string,
  matchId: string,
  sets: unknown,
) {
  return run(async () => {
    const parsed = scoreSchema.parse({ sets });
    const { supabase } = await assertRole(tournamentId, "scorekeeper");

    const { data: match } = await supabase
      .from("final_matches")
      .select(
        "id, category_id, round, slot, label, participant1_id, participant2_id",
      )
      .eq("id", matchId)
      .single();
    if (!match) throw new ActionError("Match not found.");
    const categoryId = match.category_id;

    await supabase.from("match_scores").delete().eq("final_match_id", matchId);
    const rows = parsed.sets.map((s, i) => ({
      final_match_id: matchId,
      set_number: i + 1,
      participant1_score: s.participant1_score,
      participant2_score: s.participant2_score,
    }));
    const { error } = await supabase.from("match_scores").insert(rows);
    if (error) throw new ActionError(error.message);

    const { winner, loser } = winnerLoser(
      parsed.sets,
      match.participant1_id,
      match.participant2_id,
    );

    await supabase
      .from("final_matches")
      .update({ status: "completed", winner_id: winner })
      .eq("id", matchId);

    // Propagate winner/loser to dependent matches in this category.
    const { data: all } = await supabase
      .from("final_matches")
      .select("id, round, slot, label, source1, source2")
      .eq("category_id", categoryId);

    const winRef = `W${match.round}.${match.slot}`;
    const loseRef = `L${match.round}.${match.slot}`;

    for (const fm of all ?? []) {
      if (fm.source1 === winRef)
        await supabase.from("final_matches").update({ participant1_id: winner }).eq("id", fm.id);
      if (fm.source2 === winRef)
        await supabase.from("final_matches").update({ participant2_id: winner }).eq("id", fm.id);
      if (fm.source1 === loseRef)
        await supabase.from("final_matches").update({ participant1_id: loser }).eq("id", fm.id);
      if (fm.source2 === loseRef)
        await supabase.from("final_matches").update({ participant2_id: loser }).eq("id", fm.id);
    }

    const maxRound = Math.max(...(all ?? []).map((m) => m.round), match.round);
    const isFinal = match.round === maxRound && match.label !== "Third Place";
    const isThirdPlace = match.label === "Third Place";

    if (isFinal) {
      await setPlacement(supabase, tournamentId, categoryId, "champion", winner);
      await setPlacement(supabase, tournamentId, categoryId, "runner_up", loser);
    }
    if (isThirdPlace) {
      await setPlacement(supabase, tournamentId, categoryId, "second_runner_up", winner);
      await setPlacement(supabase, tournamentId, categoryId, "third_place", loser);
    }

    // Mark the category complete when all its final matches are scored.
    const { data: remaining } = await supabase
      .from("final_matches")
      .select("id")
      .eq("category_id", categoryId)
      .neq("status", "completed")
      .limit(1);
    if (!remaining || remaining.length === 0) {
      await supabase
        .from("categories")
        .update({ status: "completed" })
        .eq("id", categoryId);
    }

    await logAudit(tournamentId, "finals.score", { categoryId, matchId });
    revalidatePath(`/dashboard/tournaments/${tournamentId}`, "layout");
  });
}
