import type { ScheduleMode } from "@/types";
import { addMinutes, timeToMinutes } from "@/lib/format";

export interface SchedulableMatch {
  id: string;
  /** Ordering of the owning category within the tournament (0-based). */
  categoryIndex: number;
  groupIndex: number;
  team1Id: string | null;
  team2Id: string | null;
}

export interface ScheduleConfig {
  startTime: string; // "08:00"
  endTime: string; // "17:00"
  interval: number; // minutes between slots
  numCourts: number;
  restPeriod: number; // minutes a team must rest between matches
  mode: ScheduleMode;
}

export interface ScheduledAssignment {
  matchId: string;
  time: string;
  court: number; // 1-based
}

export interface ScheduleResult {
  assignments: ScheduledAssignment[];
  unscheduled: string[];
  projectedEnd: string | null;
  feasible: boolean;
  totalSlots: number;
}

/**
 * Order matches by the chosen scheduling mode. Matches may span multiple
 * categories (sub-tournaments) sharing the same courts, so ordering is keyed by
 * (category, group): sequential plays category by category, distributed
 * round-robins across every category+group bucket to spread play evenly.
 */
function orderMatches(
  matches: SchedulableMatch[],
  mode: ScheduleMode,
): SchedulableMatch[] {
  if (mode === "sequential") {
    return [...matches].sort(
      (a, b) =>
        a.categoryIndex - b.categoryIndex || a.groupIndex - b.groupIndex,
    );
  }
  // distributed: round-robin pull across category+group buckets.
  const buckets = new Map<string, SchedulableMatch[]>();
  const keyOf = (m: SchedulableMatch) => `${m.categoryIndex}:${m.groupIndex}`;
  for (const m of matches) {
    const k = keyOf(m);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(m);
  }
  const order = [...buckets.keys()].sort((a, b) => {
    const [ac, ag] = a.split(":").map(Number);
    const [bc, bg] = b.split(":").map(Number);
    return ac - bc || ag - bg;
  });
  const result: SchedulableMatch[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const k of order) {
      const bucket = buckets.get(k)!;
      const next = bucket.shift();
      if (next) {
        result.push(next);
        added = true;
      }
    }
  }
  return result;
}

export function buildSchedule(
  matches: SchedulableMatch[],
  config: ScheduleConfig,
): ScheduleResult {
  const startMin = timeToMinutes(config.startTime);
  const endMin = timeToMinutes(config.endTime);
  const totalSlots =
    config.interval > 0
      ? Math.max(0, Math.floor((endMin - startMin) / config.interval) + 1)
      : 0;

  const ordered = orderMatches(matches, config.mode);
  const pending = [...ordered];
  const assignments: ScheduledAssignment[] = [];
  const lastPlayed = new Map<string, number>();

  const canPlay = (teamId: string | null, slotMin: number) => {
    if (!teamId) return true; // bye / TBD slot doesn't constrain
    const last = lastPlayed.get(teamId);
    return last === undefined || slotMin >= last + config.restPeriod;
  };

  let lastAssignedTime: string | null = null;

  for (let s = 0; s < totalSlots && pending.length > 0; s++) {
    const slotMin = startMin + s * config.interval;
    const time = addMinutes(config.startTime, s * config.interval);
    const usedTeams = new Set<string>();

    for (let court = 1; court <= config.numCourts && pending.length > 0; court++) {
      const idx = pending.findIndex((m) => {
        const t1 = m.team1Id;
        const t2 = m.team2Id;
        if (t1 && usedTeams.has(t1)) return false;
        if (t2 && usedTeams.has(t2)) return false;
        return canPlay(t1, slotMin) && canPlay(t2, slotMin);
      });
      if (idx === -1) continue; // nothing eligible for this court right now

      const [match] = pending.splice(idx, 1);
      assignments.push({ matchId: match.id, time, court });
      lastAssignedTime = time;
      if (match.team1Id) {
        usedTeams.add(match.team1Id);
        lastPlayed.set(match.team1Id, slotMin);
      }
      if (match.team2Id) {
        usedTeams.add(match.team2Id);
        lastPlayed.set(match.team2Id, slotMin);
      }
    }
  }

  return {
    assignments,
    unscheduled: pending.map((m) => m.id),
    projectedEnd: lastAssignedTime,
    feasible: pending.length === 0,
    totalSlots,
  };
}

export interface KnockoutRoundMatch {
  round: number; // 1-based; higher round = deeper into the bracket
  slot: number; // 0-based position within the round
  label: string; // e.g. "Semifinal 1", "Final", "Third Place"
}

export interface KnockoutPlaceholder {
  matchId: string;
  label: string;
  time: string;
  court: number; // 1-based
}

/**
 * Reserve time slots for knockout (placeholder) matches. Each round starts on a
 * fresh time slot, since a round can only begin once the previous round is done.
 * Matches within a round fill the available courts before advancing a slot.
 */
export function buildKnockoutSchedule(
  rounds: KnockoutRoundMatch[],
  opts: { startTime: string; interval: number; numCourts: number },
): KnockoutPlaceholder[] {
  const byRound = new Map<number, KnockoutRoundMatch[]>();
  for (const m of rounds) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  }

  const result: KnockoutPlaceholder[] = [];
  let slotIndex = 0;

  for (const round of [...byRound.keys()].sort((a, b) => a - b)) {
    const matches = byRound.get(round)!.sort((a, b) => a.slot - b.slot);
    let court = 1;
    for (const m of matches) {
      if (court > opts.numCourts) {
        court = 1;
        slotIndex++;
      }
      result.push({
        matchId: crypto.randomUUID(),
        label: m.label,
        time: addMinutes(opts.startTime, slotIndex * opts.interval),
        court,
      });
      court++;
    }
    slotIndex++; // next round starts on a fresh slot
  }

  return result;
}
