"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { ActionError, assertRole, logAudit, run } from "./helpers";
import { scheduleSchema, type ScheduleInput } from "@/validators";
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
import type { CategorySettings } from "@/types";
import type { Database } from "@/types/database";

/** A category as the scheduler needs it. */
type TargetCategory = {
  id: string;
  name: string;
  settings: CategorySettings | null;
  event_date: string | null;
};

/**
 * A court/time a match already holds, dated absolutely. Categories are played
 * on their own days, so slots only travel between them as real dates; each
 * category converts them to its own day offsets.
 */
type Occupancy = { date: string | null; time: string; court: number };

/** What one category's run produced, for the caller's summary. */
type CategoryRun = {
  categoryId: string;
  name: string;
  scheduled: number;
  unscheduled: number;
  feasible: boolean;
  projectedEnd: string | null;
  knockoutReserved: number;
  /** Every slot this category holds afterwards, for the categories after it. */
  occupied: Occupancy[];
};

/**
 * Build (or rebuild) a schedule.
 *
 * `cfg.scope` decides how far the run reaches:
 * - `category` — only the category the page is on. `cfg.group_ids` can narrow
 *   it further to some of that category's groups, since groups play on
 *   different days: each day's groups are generated on their own run with
 *   their own date, and the groups left out keep the slots they already have.
 * - `tournament` — every category still in draft, laid out one after another.
 *   Courts are shared venue-wide, so each category is scheduled around the
 *   slots the earlier ones (and any already-started category) took, and
 *   nothing is double-booked. Categories keep their own play dates; the date
 *   on the form only fills in the ones that have none.
 */
export async function generateSchedule(
  tournamentId: string,
  categoryId: string,
  input: unknown,
) {
  return run(async () => {
    const cfg = scheduleSchema.parse(input);
    const { supabase } = await assertRole(tournamentId, "admin");

    const { data: categories } = await supabase
      .from("categories")
      .select("id, name, status, settings, event_date")
      .eq("tournament_id", tournamentId)
      .order("position");
    const active = (categories ?? []).find((c) => c.id === categoryId);
    if (!active) throw new ActionError("Category not found.");

    // A tournament-wide run only touches categories whose schedule is still
    // editable — once a group stage starts, its times and courts are locked.
    const targets =
      cfg.scope === "tournament"
        ? (categories ?? []).filter((c) => c.status === "draft")
        : [active];
    if (targets.length === 0) {
      throw new ActionError(
        "Every category has already started — schedules lock once the group stage begins.",
      );
    }

    // Courts are shared venue infrastructure, created once for the whole run.
    // Ensure enough exist without destroying courts that other categories'
    // schedules already reference.
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

    // Slots held by categories this run doesn't touch (already started ones).
    // A single-category run keeps its historical behaviour and ignores them:
    // organisers stagger start times themselves there.
    const occupied: Occupancy[] = [];
    if (cfg.scope === "tournament") {
      const targetIds = new Set(targets.map((c) => c.id));
      const { data: otherSlots } = await supabase
        .from("match_schedules")
        .select("category_id, court_id, scheduled_time, scheduled_date")
        .eq("tournament_id", tournamentId);
      (otherSlots ?? []).forEach((row) => {
        if (!row.category_id || targetIds.has(row.category_id)) return;
        const court = row.court_id ? posByCourtId.get(row.court_id) : undefined;
        if (!court || !row.scheduled_time) return;
        occupied.push({
          date: row.scheduled_date,
          time: row.scheduled_time,
          court,
        });
      });
    }

    const runs: CategoryRun[] = [];
    const skipped: string[] = [];
    for (const category of targets) {
      // A category keeps its own play date; on a tournament-wide run the form's
      // date only fills in categories that have none. On a single-category run
      // the form is the edit, so it wins.
      const eventDate =
        cfg.scope === "tournament"
          ? category.event_date || cfg.event_date || null
          : cfg.event_date || category.event_date || null;

      const result = await scheduleCategory(supabase, tournamentId, {
        category: category as TargetCategory,
        cfg,
        eventDate,
        // Whole categories only, once the run spans the tournament.
        groupIds: cfg.scope === "tournament" ? [] : cfg.group_ids,
        courtIdByPos,
        posByCourtId,
        external: occupied,
        // A single-category run still reports "generate groups first"; a
        // tournament-wide one just steps over categories with no matches.
        skipEmpty: cfg.scope === "tournament",
      });
      if (!result) {
        skipped.push(category.name);
        continue;
      }
      runs.push(result);
      occupied.push(...result.occupied);
    }

    const scheduled = runs.reduce((n, r) => n + r.scheduled, 0);
    const unscheduled = runs.reduce((n, r) => n + r.unscheduled, 0);
    const knockoutReserved = runs.reduce((n, r) => n + r.knockoutReserved, 0);
    // The board's last start time across the run. Times carry no date here, so
    // this is a display figure, not an ordering key.
    const projectedEnd = runs.reduce<string | null>(
      (latest, r) =>
        r.projectedEnd && (!latest || r.projectedEnd > latest)
          ? r.projectedEnd
          : latest,
      null,
    );

    await logAudit(tournamentId, "schedule.generate", {
      scope: cfg.scope,
      categoryId,
      categories: runs.map((r) => r.categoryId),
      skipped: skipped.length,
      knockoutReserved,
      scheduled,
      unscheduled,
    });
    revalidatePath(`/dashboard/tournaments/${tournamentId}/schedule`);
    return {
      scope: cfg.scope,
      scheduled,
      unscheduled,
      feasible: unscheduled === 0,
      projectedEnd,
      knockoutReserved,
      /** Per-category breakdown, in the order they were laid out. */
      categories: runs.map((r) => ({
        name: r.name,
        scheduled: r.scheduled,
        unscheduled: r.unscheduled,
        knockoutReserved: r.knockoutReserved,
      })),
      /** Categories with nothing to schedule yet (no groups or no matches). */
      skipped,
    };
  });
}

/**
 * Lay out one category on the shared courts.
 *
 * Returns `null` when the category has no matches to schedule and `skipEmpty`
 * allows passing over it; otherwise that is a user-facing error.
 */
async function scheduleCategory(
  supabase: SupabaseClient<Database>,
  tournamentId: string,
  opts: {
    category: TargetCategory;
    cfg: ScheduleInput;
    eventDate: string | null;
    groupIds: string[];
    courtIdByPos: Map<number, string>;
    posByCourtId: Map<string, number>;
    external: Occupancy[];
    skipEmpty: boolean;
  },
): Promise<CategoryRun | null> {
  const { category, cfg, eventDate, courtIdByPos, posByCourtId } = opts;
  const categoryId = category.id;

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
  await supabase.from("categories").update({ settings }).eq("id", categoryId);

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
  const unknown = opts.groupIds.filter((id) => !posByGroup.has(id));
  if (unknown.length) {
    throw new ActionError("Those groups don't belong to this category.");
  }
  const selectedGroups = new Set(
    opts.groupIds.length ? opts.groupIds : posByGroup.keys(),
  );

  const { data: matches, error: mErr } = await supabase
    .from("group_matches")
    .select("id, group_id, participant1_id, participant2_id, round")
    .eq("tournament_id", tournamentId)
    .eq("category_id", categoryId)
    .order("round");
  if (mErr) throw new ActionError(mErr.message);
  if (!matches || matches.length === 0) {
    if (opts.skipEmpty) return null;
    throw new ActionError(
      "Generate groups and matches for this category first.",
    );
  }
  const groupByMatch = new Map(matches.map((m) => [m.id, m.group_id]));
  const runMatches = matches.filter((m) => selectedGroups.has(m.group_id));
  if (runMatches.length === 0) {
    if (opts.skipEmpty) return null;
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
   * A slot's offset from this run's date. Slots on another day can't collide
   * with it, and neither can undated ones once a date is in play.
   */
  const dayOffset = (date: string | null): number | null => {
    if (!eventDate) return date ? null : 0;
    return date ? diffDays(eventDate, date) : null;
  };

  /** Turn absolute slots into this run's day offsets, dropping what can't clash. */
  const toReserved = (slots: Occupancy[]): ReservedSlot[] => {
    const out: ReservedSlot[] = [];
    for (const s of slots) {
      const day = dayOffset(s.date);
      if (day === null || day < 0) continue;
      out.push({ day, time: s.time, court: s.court });
    }
    return out;
  };

  const staleSlotIds: string[] = [];
  const keptSlots: ReservedSlot[] = [];
  // Everything this category still holds afterwards, for the categories that
  // follow it — including slots on other days, which can't clash here but can
  // clash with a category played that day.
  const occupied: Occupancy[] = [];
  (existingSlots ?? []).forEach((row) => {
    const groupId = row.match_id ? groupByMatch.get(row.match_id) : undefined;
    // Orphans (their match is gone) go with the rebuild.
    if (!groupId || selectedGroups.has(groupId)) {
      staleSlotIds.push(row.id);
      return;
    }
    const court = row.court_id ? posByCourtId.get(row.court_id) : undefined;
    if (!court || !row.scheduled_time) return;
    occupied.push({
      date: row.scheduled_date,
      time: row.scheduled_time,
      court,
    });
    const day = dayOffset(row.scheduled_date);
    if (day === null || day < 0) return;
    keptSlots.push({ day, time: row.scheduled_time, court });
  });

  const schedulable: SchedulableMatch[] = runMatches.map((m) => ({
    id: m.id,
    categoryIndex: 0,
    groupIndex: posByGroup.get(m.group_id) ?? 0,
    team1Id: m.participant1_id,
    team2Id: m.participant2_id,
  }));

  const externalReserved = toReserved(opts.external);
  const result = buildSchedule(schedulable, {
    startTime: cfg.start_time,
    endTime: cfg.end_time,
    interval: cfg.match_interval,
    numCourts: cfg.num_courts,
    mode: cfg.schedule_mode,
    reserved: [...keptSlots, ...externalReserved],
  });

  // Replace this run's group slots. Knockout placeholders always go: they sit
  // after the whole group stage, which just moved.
  if (staleSlotIds.length) {
    await supabase.from("match_schedules").delete().in("id", staleSlotIds);
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
  result.assignments.forEach((a) =>
    occupied.push({ date: dateForDay(a.day), time: a.time, court: a.court }),
  );

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
      // the groups this run kept rather than rebuilt. Other categories don't
      // hold it back — it only steps around the slots they hold.
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
          reserved: externalReserved,
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
          placeholders.forEach((p) =>
            occupied.push({
              date: dateForDay(p.day),
              time: p.time,
              court: p.court,
            }),
          );
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

  return {
    categoryId,
    name: category.name,
    scheduled: result.assignments.length,
    unscheduled: result.unscheduled.length,
    feasible: result.feasible,
    projectedEnd: result.projectedEnd,
    knockoutReserved,
    occupied,
  };
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
