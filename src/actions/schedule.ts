"use server";

import { revalidatePath } from "next/cache";
import { ActionError, assertRole, logAudit, run } from "./helpers";
import { scheduleSchema } from "@/validators";
import {
  buildKnockoutSchedule,
  buildSchedule,
  type KnockoutRoundMatch,
  type SchedulableMatch,
} from "@/services/scheduler";
import {
  generateFinalBracket,
  type QualifierSlot,
} from "@/services/brackets";
import { addMinutes, timeToMinutes } from "@/lib/format";

// Top N from each group advance to the knockout bracket.
const ADVANCE_PER_GROUP = 2;

export async function generateSchedule(
  tournamentId: string,
  categoryId: string,
  input: unknown,
) {
  return run(async () => {
    const cfg = scheduleSchema.parse(input);
    const { supabase } = await assertRole(tournamentId, "admin");

    // Each category is an independent competition and is scheduled on its own.
    const { data: category } = await supabase
      .from("categories")
      .select("id, settings")
      .eq("id", categoryId)
      .eq("tournament_id", tournamentId)
      .single();
    if (!category) throw new ActionError("Category not found.");

    // Persist schedule settings on the category (it remembers its own config).
    const settings = {
      ...(category.settings ?? {}),
      venue_name: cfg.venue_name,
      start_time: cfg.start_time,
      end_time: cfg.end_time,
      match_interval: cfg.match_interval,
      num_courts: cfg.num_courts,
      rest_period: cfg.rest_period,
      schedule_mode: cfg.schedule_mode,
      knockout_rounds: cfg.knockout_rounds,
    };
    await supabase
      .from("categories")
      .update({ settings })
      .eq("id", categoryId);

    // Courts are shared venue infrastructure. Ensure enough exist without
    // destroying courts that other categories' schedules already reference.
    const { data: existingCourts } = await supabase
      .from("courts")
      .select("id, position")
      .eq("tournament_id", tournamentId)
      .order("position");
    const courtIdByPos = new Map<number, string>();
    (existingCourts ?? []).forEach((c) => courtIdByPos.set(c.position, c.id));
    const missingCourts = [];
    for (let pos = 1; pos <= cfg.num_courts; pos++) {
      if (!courtIdByPos.has(pos)) {
        missingCourts.push({
          tournament_id: tournamentId,
          name: `Court ${pos}`,
          position: pos,
        });
      }
    }
    if (missingCourts.length) {
      const { data: created, error: cErr } = await supabase
        .from("courts")
        .insert(missingCourts)
        .select("id, position");
      if (cErr) throw new ActionError(cErr.message);
      (created ?? []).forEach((c) => courtIdByPos.set(c.position, c.id));
    }

    // Gather this category's group matches with their group position.
    const { data: groups } = await supabase
      .from("groups")
      .select("id, position")
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId);
    const posByGroup = new Map<string, number>();
    (groups ?? []).forEach((g) => posByGroup.set(g.id, g.position));

    const { data: matches, error: mErr } = await supabase
      .from("group_matches")
      .select("id, group_id, participant1_id, participant2_id, round")
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId)
      .order("round");
    if (mErr) throw new ActionError(mErr.message);
    if (!matches || matches.length === 0) {
      throw new ActionError(
        "Generate groups and matches for this category first.",
      );
    }

    const schedulable: SchedulableMatch[] = matches.map((m) => ({
      id: m.id,
      categoryIndex: 0,
      groupIndex: posByGroup.get(m.group_id) ?? 0,
      team1Id: m.participant1_id,
      team2Id: m.participant2_id,
    }));

    const result = buildSchedule(schedulable, {
      startTime: cfg.start_time,
      endTime: cfg.end_time,
      interval: cfg.match_interval,
      numCourts: cfg.num_courts,
      restPeriod: cfg.rest_period,
      mode: cfg.schedule_mode,
    });

    // Replace only THIS category's schedule.
    await supabase
      .from("match_schedules")
      .delete()
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId);

    const scheduleRows = result.assignments.map((a) => ({
      tournament_id: tournamentId,
      category_id: categoryId,
      match_type: "group" as const,
      match_id: a.matchId,
      court_id: courtIdByPos.get(a.court) ?? null,
      scheduled_time: a.time,
      status: "pending" as const,
    }));
    if (scheduleRows.length) {
      const { error } = await supabase
        .from("match_schedules")
        .insert(scheduleRows);
      if (error) throw new ActionError(error.message);
    }

    // Reserve placeholder slots for this category's knockout bracket. Real
    // bracket matches don't exist yet (finals are generated after the group
    // stage), so we derive the structure from the expected qualifier count.
    let knockoutReserved = 0;
    if (cfg.knockout_rounds !== "none") {
      const qualifierCount = (groups?.length ?? 0) * ADVANCE_PER_GROUP;
      if (qualifierCount >= 2) {
        const startBaseMin = timeToMinutes(cfg.start_time);
        const lastGroupMin = result.assignments.reduce(
          (max, a) => Math.max(max, timeToMinutes(a.time)),
          startBaseMin - cfg.match_interval,
        );
        const koStart = addMinutes(
          cfg.start_time,
          lastGroupMin - startBaseMin + cfg.match_interval,
        );

        // Dummy qualifiers just give us the bracket shape (rounds + labels).
        const dummies: QualifierSlot[] = Array.from(
          { length: qualifierCount },
          (_, i) => ({
            label: `Q${i + 1}`,
            participantId: null,
            groupIndex: i,
            position: 1,
            overallSeed: i + 1,
          }),
        );
        const bracket = generateFinalBracket(dummies, "standard_seed");
        const maxRound = bracket.reduce((m, b) => Math.max(m, b.round), 0);
        // "semifinals" stops before the final round (which holds the final and
        // the third-place playoff); "finals" includes everything.
        const selected: KnockoutRoundMatch[] = bracket
          .filter((b) =>
            cfg.knockout_rounds === "finals" ? true : b.round < maxRound,
          )
          .map((b) => ({ round: b.round, slot: b.slot, label: b.label }));

        if (selected.length) {
          const placeholders = buildKnockoutSchedule(selected, {
            startTime: koStart,
            interval: cfg.match_interval,
            numCourts: cfg.num_courts,
          });
          const koRows = placeholders.map((p) => ({
            tournament_id: tournamentId,
            category_id: categoryId,
            match_type: "knockout" as const,
            match_id: p.matchId,
            label: p.label,
            court_id: courtIdByPos.get(p.court) ?? null,
            scheduled_time: p.time,
            status: "pending" as const,
          }));
          if (koRows.length) {
            const { error } = await supabase
              .from("match_schedules")
              .insert(koRows);
            if (error) throw new ActionError(error.message);
            knockoutReserved = koRows.length;
          }
        }
      }
    }

    await logAudit(tournamentId, "schedule.generate", {
      categoryId,
      knockoutReserved,
      scheduled: result.assignments.length,
      unscheduled: result.unscheduled.length,
    });
    revalidatePath(`/dashboard/tournaments/${tournamentId}/schedule`);
    return {
      scheduled: result.assignments.length,
      unscheduled: result.unscheduled.length,
      feasible: result.feasible,
      projectedEnd: result.projectedEnd,
      knockoutReserved,
    };
  });
}
