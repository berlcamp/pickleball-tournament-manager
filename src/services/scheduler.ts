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
  /** Days past the event start date, for slots that roll past midnight. */
  day: number;
  court: number; // 1-based
}

export interface ScheduleResult {
  assignments: ScheduledAssignment[];
  unscheduled: string[];
  projectedEnd: string | null;
  feasible: boolean;
  totalSlots: number;
}

/** Bucket matches by their owning group, preserving input (round) order. */
function bucketByGroup(
  matches: SchedulableMatch[],
): { key: string; matches: SchedulableMatch[] }[] {
  const buckets = new Map<string, SchedulableMatch[]>();
  for (const m of matches) {
    const k = `${m.categoryIndex}:${m.groupIndex}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(m);
  }
  return [...buckets.keys()]
    .sort((a, b) => {
      const [ac, ag] = a.split(":").map(Number);
      const [bc, bg] = b.split(":").map(Number);
      return ac - bc || ag - bg;
    })
    .map((key) => ({ key, matches: buckets.get(key)! }));
}

/** Interleave several ordered lists round-robin into a single list. */
function interleave<T>(lists: T[][]): T[] {
  const queues = lists.map((l) => [...l]);
  const out: T[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
  }
  return out;
}

/**
 * Build the group-stage schedule. Every group is pinned to a single court, so a
 * group never jumps courts — all of its matches play out on the same court, one
 * after another. Groups are dealt across the available courts round-robin; when
 * there are more groups than courts, a court simply hosts several groups in
 * turn. `sequential` plays a court's groups one whole group at a time;
 * `distributed` round-robins a court's groups so they progress together.
 */
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
  const numCourts = Math.max(1, config.numCourts);

  // Deal each group to a court and keep it there. Assign the biggest groups
  // first, each onto the court that currently holds the fewest matches, so
  // court loads stay balanced (a group is never split — it just lands on the
  // least-busy court). Round-robin dealing instead would pile two groups onto
  // one court while others sit idle, overflowing the day window needlessly.
  const groups = bucketByGroup(matches);
  const courtGroups: SchedulableMatch[][][] = Array.from(
    { length: numCourts },
    () => [],
  );
  const courtLoad = new Array<number>(numCourts).fill(0);
  [...groups]
    .sort((a, b) => b.matches.length - a.matches.length)
    .forEach((g) => {
      let target = 0;
      for (let c = 1; c < numCourts; c++) {
        if (courtLoad[c] < courtLoad[target]) target = c;
      }
      courtGroups[target].push(g.matches);
      courtLoad[target] += g.matches.length;
    });

  const assignments: ScheduledAssignment[] = [];
  const unscheduled: string[] = [];
  const lastPlayed = new Map<string, number>();
  let lastAssignedTime: string | null = null;
  let lastAssignedMin = -1; // absolute minutes, so past-midnight slots sort right

  const canPlay = (teamId: string | null, slotMin: number) => {
    if (!teamId) return true; // bye / TBD slot doesn't constrain
    const last = lastPlayed.get(teamId);
    return last === undefined || slotMin >= last + config.restPeriod;
  };

  for (let court = 1; court <= numCourts; court++) {
    const groupsHere = courtGroups[court - 1];
    if (groupsHere.length === 0) continue;

    // Order this court's matches: sequential plays each group through in turn,
    // distributed round-robins between the groups sharing the court.
    const courtMatches =
      config.mode === "distributed"
        ? interleave(groupsHere)
        : groupsHere.flat();

    let slot = 0;
    for (const match of courtMatches) {
      // Advance to the next slot on this court where both teams have rested.
      while (slot < totalSlots) {
        const slotMin = startMin + slot * config.interval;
        if (canPlay(match.team1Id, slotMin) && canPlay(match.team2Id, slotMin)) {
          break;
        }
        slot++;
      }
      if (slot >= totalSlots) {
        unscheduled.push(match.id);
        continue;
      }

      const slotMin = startMin + slot * config.interval;
      const time = addMinutes(config.startTime, slot * config.interval);
      const day = Math.floor(slotMin / (24 * 60));
      assignments.push({ matchId: match.id, time, day, court });
      if (slotMin > lastAssignedMin) {
        lastAssignedMin = slotMin;
        lastAssignedTime = time;
      }
      if (match.team1Id) lastPlayed.set(match.team1Id, slotMin);
      if (match.team2Id) lastPlayed.set(match.team2Id, slotMin);
      slot++; // next match on this court takes the following slot
    }
  }

  return {
    assignments,
    unscheduled,
    projectedEnd: lastAssignedTime,
    feasible: unscheduled.length === 0,
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
  /** Days past the event start date, for slots that roll past midnight. */
  day: number;
  court: number; // 1-based
}

/**
 * Reserve time slots for knockout (placeholder) matches. Each round starts on a
 * fresh time slot, since a round can only begin once the previous round is done.
 * Matches within a round fill the available courts before advancing a slot.
 */
export function buildKnockoutSchedule(
  rounds: KnockoutRoundMatch[],
  opts: {
    startTime: string;
    interval: number;
    numCourts: number;
    /** Day offset of `startTime` when the knockout stage begins next day+. */
    startDay?: number;
  },
): KnockoutPlaceholder[] {
  const byRound = new Map<number, KnockoutRoundMatch[]>();
  for (const m of rounds) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push(m);
  }

  const startMin = timeToMinutes(opts.startTime);
  const baseDay = opts.startDay ?? 0;
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
      const offsetMin = slotIndex * opts.interval;
      result.push({
        matchId: crypto.randomUUID(),
        label: m.label,
        time: addMinutes(opts.startTime, offsetMin),
        day: baseDay + Math.floor((startMin + offsetMin) / (24 * 60)),
        court,
      });
      court++;
    }
    slotIndex++; // next round starts on a fresh slot
  }

  return result;
}
