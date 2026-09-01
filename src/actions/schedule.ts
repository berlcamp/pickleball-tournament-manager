"use server";

import { revalidatePath } from "next/cache";
import { ActionError, assertRole, logAudit, run } from "./helpers";
import { scheduleSchema } from "@/validators";
import {
  buildKnockoutSchedule,
  buildSchedule,
  type KnockoutRoundMatch,
  type ReservedSlot,
  type SchedulableMatch,
} from "@/services/scheduler";
import {
  generateFinalBracket,
  type QualifierSlot,
} from "@/services/brackets";
import { addDays, addMinutes, diffDays, timeToMinutes } from "@/lib/format";
import { ADVANCE_PER_GROUP } from "@/lib/constants";

/**
 * Build (or rebuild) a category's schedule.
 *
 * `cfg.group_ids` narrows the run to some of the category's groups — groups
 * play on different days, so each day's groups are scheduled on their own run
 * with their own date. Groups left out keep the slots they already hold, and
 * this run schedules around them. An empty list means every group.
 */
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
      .select("id, settings, event_date")
      .eq("id", categoryId)
      .eq("tournament_id", tournamentId)
      .single();
    if (!category) throw new ActionError("Category not found.");

    // Persist schedule settings on the category (it remembers its own config).
    // The play date is a column, not a setting — the public portal shows it,
    // and it is written at the end, once the slots are known.
    const settings = {
      ...(category.settings ?? {}),
      venue_name: cfg.venue_name,
      start_time: cfg.start_time,
      end_time: cfg.end_time,
      match_interval: cfg.match_interval,
      num_courts: cfg.num_courts,
      schedule_mode: cfg.schedule_mode,
      knockout_rounds: cfg.knockout_rounds,
    };
    // The date this run's matches are played on. Leaving the field blank keeps
    // whatever the category already had.
    const eventDate = cfg.event_date || category.event_date || null;
    await supabase.from("categories").update({ settings }).eq("id", categoryId);

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
    const posByCourtId = new Map<string, number>();
    courtIdByPos.forEach((id, pos) => posByCourtId.set(id, pos));

    // Gather this category's group matches with their group position.
    const { data: groups } = await supabase
      .from("groups")
      .select("id, position")
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId);
    const posByGroup = new Map<string, number>();
    (groups ?? []).forEach((g) => posByGroup.set(g.id, g.position));

    // No selection means the whole category; a selection has to name groups
    // that actually belong to it.
    const unknown = cfg.group_ids.filter((id) => !posByGroup.has(id));
    if (unknown.length) {
      throw new ActionError("Those groups don't belong to this category.");
    }
    const selectedGroups = new Set(
      cfg.group_ids.length ? cfg.group_ids : posByGroup.keys(),
    );

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
    const groupByMatch = new Map(matches.map((m) => [m.id, m.group_id]));
    const runMatches = matches.filter((m) => selectedGroups.has(m.group_id));
    if (runMatches.length === 0) {
      throw new ActionError("The selected groups have no matches yet.");
    }

    // Existing group slots: those of the selected groups are replaced, the rest
    // are kept and scheduled around.
    const { data: existingSlots } = await supabase
      .from("match_schedules")
      .select("id, match_id, court_id, scheduled_time, scheduled_date")
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId)
      .eq("match_type", "group");

    /**
     * A kept slot's offset from this run's date. Slots on another day can't
     * collide with it, and neither can undated ones once a date is in play.
     */
    const dayOffset = (date: string | null): number | null => {
      if (!eventDate) return date ? null : 0;
      return date ? diffDays(eventDate, date) : null;
    };

    const staleSlotIds: string[] = [];
    const keptSlots: { day: number; time: string; court: number }[] = [];
    (existingSlots ?? []).forEach((row) => {
      const groupId = row.match_id ? groupByMatch.get(row.match_id) : undefined;
      // Orphans (their match is gone) go with the rebuild.
      if (!groupId || selectedGroups.has(groupId)) {
        staleSlotIds.push(row.id);
        return;
      }
      const day = dayOffset(row.scheduled_date);
      const court = row.court_id ? posByCourtId.get(row.court_id) : undefined;
      if (day === null || day < 0 || !court || !row.scheduled_time) return;
      keptSlots.push({ day, time: row.scheduled_time, court });
    });

    const schedulable: SchedulableMatch[] = runMatches.map((m) => ({
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
      mode: cfg.schedule_mode,
      reserved: keptSlots as ReservedSlot[],
    });

    // Replace this run's group slots. Knockout placeholders always go: they sit
    // after the whole group stage, which just moved.
    if (staleSlotIds.length) {
      await supabase
        .from("match_schedules")
        .delete()
        .in("id", staleSlotIds);
    }
    await supabase
      .from("match_schedules")
      .delete()
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId)
      .eq("match_type", "knockout");

    // Slots that roll past midnight carry a day offset; push their date forward.
    const dateForDay = (day: number) =>
      eventDate ? addDays(eventDate, day) : null;

    const scheduleRows = result.assignments.map((a) => ({
      tournament_id: tournamentId,
      category_id: categoryId,
      match_type: "group" as const,
      match_id: a.matchId,
      court_id: courtIdByPos.get(a.court) ?? null,
      scheduled_time: a.time,
      scheduled_date: dateForDay(a.day),
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
        // Work in absolute minutes so a group stage that runs past midnight
        // pushes the knockout start onto the correct (later) day.
        const startBaseMin = timeToMinutes(cfg.start_time);
        // The bracket follows the LAST group match of the category, including
        // the groups this run kept rather than rebuilt.
        const lastGroupAbs = [...result.assignments, ...keptSlots].reduce(
          (max, a) => Math.max(max, a.day * 24 * 60 + timeToMinutes(a.time)),
          startBaseMin - cfg.match_interval,
        );
        const koStartAbs = lastGroupAbs + cfg.match_interval;
        const koStartDay = Math.floor(koStartAbs / (24 * 60));
        const koStart = addMinutes(cfg.start_time, koStartAbs - startBaseMin);

        // Dummy qualifiers just give us the bracket shape (rounds + labels).
        const dummies: QualifierSlot[] = Array.from(
          { length: qualifierCount },
          (_, i) => ({
            label: `Q${i + 1}`,
            participantId: null,
            groupIndex: i,
            position: 1,
            record: {
              matchesWon: 0,
              matchesPlayed: 0,
              pointDiff: 0,
              points: 0,
            },
          }),
        );
        const bracket = generateFinalBracket(dummies);
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
            startDay: koStartDay,
          });
          const koRows = placeholders.map((p) => ({
            tournament_id: tournamentId,
            category_id: categoryId,
            match_type: "knockout" as const,
            match_id: p.matchId,
            label: p.label,
            court_id: courtIdByPos.get(p.court) ?? null,
            scheduled_time: p.time,
            scheduled_date: dateForDay(p.day),
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

    // The category's published date is the day it first plays — which, with
    // groups spread over several days, is the earliest slot on the board.
    const { data: earliest } = await supabase
      .from("match_schedules")
      .select("scheduled_date")
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId)
      .eq("match_type", "group")
      .not("scheduled_date", "is", null)
      .order("scheduled_date")
      .limit(1);
    const categoryDate = earliest?.[0]?.scheduled_date ?? eventDate;
    if (categoryDate !== category.event_date) {
      await supabase
        .from("categories")
        .update({ event_date: categoryDate })
        .eq("id", categoryId);
    }

    await logAudit(tournamentId, "schedule.generate", {
      categoryId,
      groups: cfg.group_ids.length || (groups?.length ?? 0),
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

/** Remove every scheduled slot (group + reserved knockout) for one category. */
export async function clearSchedule(
  tournamentId: string,
  categoryId: string,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "admin");

    const { error } = await supabase
      .from("match_schedules")
      .delete()
      .eq("tournament_id", tournamentId)
      .eq("category_id", categoryId);
    if (error) throw new ActionError(error.message);

    await logAudit(tournamentId, "schedule.clear", { categoryId });
    revalidatePath(`/dashboard/tournaments/${tournamentId}/schedule`);
  });
}

/** Toggle a scheduled slot's "queued" flag (called-to-court marker). */
export async function toggleQueued(
  tournamentId: string,
  scheduleId: string,
  queued: boolean,
) {
  return run(async () => {
    const { supabase } = await assertRole(tournamentId, "scorekeeper");

    const { error } = await supabase
      .from("match_schedules")
      .update({ queued })
      .eq("id", scheduleId)
      .eq("tournament_id", tournamentId);
    if (error) throw new ActionError(error.message);

    revalidatePath(`/dashboard/tournaments/${tournamentId}/schedule`);
  });
}
