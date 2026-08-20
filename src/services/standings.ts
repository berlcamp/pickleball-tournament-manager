import type { StandingStatus } from "@/types";

export interface MatchSet {
  participant1_score: number;
  participant2_score: number;
}

export interface ScoredMatch {
  participant1Id: string;
  participant2Id: string;
  sets: MatchSet[];
  completed: boolean;
}

export interface ComputedStanding {
  participantId: string;
  rank: number;
  status: StandingStatus;
  matchesWon: number;
  matchesLost: number;
  matchesTied: number;
  tieBreak: number;
  setWins: number;
  setTies: number;
  points: number;
  pointDiff: number;
  history: ("W" | "L" | "T")[];
}

function blank(participantId: string): ComputedStanding {
  return {
    participantId,
    rank: 0,
    status: "none",
    matchesWon: 0,
    matchesLost: 0,
    matchesTied: 0,
    tieBreak: 0,
    setWins: 0,
    setTies: 0,
    points: 0,
    pointDiff: 0,
    history: [],
  };
}

/**
 * Compute standings for a single group.
 *
 * Scoring model (pickleball): a match is one or more sets/games. The team
 * winning the most sets wins the match. "Pts" is the cumulative points the
 * team scored across all sets. Point differential is points-for minus
 * points-against and is used as a tie-breaker.
 *
 * @param options.advanceCount mark top N teams as "advanced" once the group
 *        is complete (all matches scored).
 */
export function computeGroupStandings(
  participantIds: string[],
  matches: ScoredMatch[],
  options: { advanceCount?: number; randomTiebreak?: boolean } = {},
): ComputedStanding[] {
  const table = new Map<string, ComputedStanding>();
  participantIds.forEach((id) => table.set(id, blank(id)));

  // Head-to-head store: h2h[a][b] = match wins of a vs b
  const h2h = new Map<string, Map<string, number>>();
  const bump = (a: string, b: string) => {
    if (!h2h.has(a)) h2h.set(a, new Map());
    const inner = h2h.get(a)!;
    inner.set(b, (inner.get(b) ?? 0) + 1);
  };

  for (const m of matches) {
    if (!m.completed) continue;
    const s1 = table.get(m.participant1Id);
    const s2 = table.get(m.participant2Id);
    if (!s1 || !s2) continue;

    let p1Sets = 0;
    let p2Sets = 0;
    let setTies = 0;
    let p1Points = 0;
    let p2Points = 0;

    for (const set of m.sets) {
      p1Points += set.participant1_score;
      p2Points += set.participant2_score;
      if (set.participant1_score > set.participant2_score) p1Sets++;
      else if (set.participant2_score > set.participant1_score) p2Sets++;
      else setTies++;
    }

    s1.setWins += p1Sets;
    s2.setWins += p2Sets;
    s1.setTies += setTies;
    s2.setTies += setTies;
    s1.points += p1Points;
    s2.points += p2Points;
    s1.pointDiff += p1Points - p2Points;
    s2.pointDiff += p2Points - p1Points;

    if (p1Sets > p2Sets) {
      s1.matchesWon++;
      s2.matchesLost++;
      s1.history.push("W");
      s2.history.push("L");
      bump(m.participant1Id, m.participant2Id);
    } else if (p2Sets > p1Sets) {
      s2.matchesWon++;
      s1.matchesLost++;
      s2.history.push("W");
      s1.history.push("L");
      bump(m.participant2Id, m.participant1Id);
    } else {
      s1.matchesTied++;
      s2.matchesTied++;
      s1.history.push("T");
      s2.history.push("T");
    }
  }

  const standings = [...table.values()];

  // Tie-break (TB): head-to-head wins counted ONLY against teams sharing the
  // same primary record (match wins). For a two-way tie it's 0 or 1 (whoever
  // won the head-to-head); for a 3+ way tie it's how many of the other tied
  // teams a team beat. Teams that aren't tied on match wins keep TB = 0.
  const byWins = new Map<number, ComputedStanding[]>();
  for (const s of standings) {
    if (!byWins.has(s.matchesWon)) byWins.set(s.matchesWon, []);
    byWins.get(s.matchesWon)!.push(s);
  }
  for (const group of byWins.values()) {
    if (group.length < 2) continue; // not tied → TB stays 0
    const tiedIds = new Set(group.map((s) => s.participantId));
    for (const s of group) {
      const wins = h2h.get(s.participantId);
      if (!wins) continue;
      let tb = 0;
      for (const [oppId, count] of wins) {
        if (tiedIds.has(oppId)) tb += count;
      }
      s.tieBreak = tb;
    }
  }

  // Sort applying tie-breaker rules.
  standings.sort((a, b) => {
    // 1. Most match wins
    if (b.matchesWon !== a.matchesWon) return b.matchesWon - a.matchesWon;

    // 2. Tie-break: head-to-head wins among the tied teams
    if (b.tieBreak !== a.tieBreak) return b.tieBreak - a.tieBreak;

    // 3. Set wins. A match is decided on sets, so how many sets a team took
    //    across the group is the closest thing to a second record.
    if (b.setWins !== a.setWins) return b.setWins - a.setWins;

    // 4. Point differential — points scored minus conceded.
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;

    // 5. Total points scored. Deliberately BELOW differential: games run to a
    //    fixed target, so the winner of a game nearly always scores the same
    //    amount and this number is driven mostly by how many sets a team
    //    played and how close its losses were. Ranking on it above
    //    differential would put a team that squeaked through above one that
    //    dominated.
    if (b.points !== a.points) return b.points - a.points;

    // 6. Direct head-to-head: the team that won the match between these two
    //    specific teams ranks higher. This is distinct from step 2, which is a
    //    mini-league win count across everyone sharing the same match-win total
    //    and can stay level in a 3-way cycle even when the direct result is
    //    decisive.
    const aOverB = h2h.get(a.participantId)?.get(b.participantId) ?? 0;
    const bOverA = h2h.get(b.participantId)?.get(a.participantId) ?? 0;
    if (aOverB !== bOverA) return bOverA - aOverB;

    // 7. Random draw (never enabled by callers; kept as an opt-in fallback)
    if (options.randomTiebreak) return Math.random() - 0.5;
    return 0;
  });

  const allComplete =
    matches.length > 0 && matches.every((m) => m.completed);

  standings.forEach((s, i) => {
    s.rank = i + 1;
    if (allComplete && options.advanceCount && i < options.advanceCount) {
      s.status = "advanced";
    } else if (allComplete && options.advanceCount) {
      s.status = "eliminated";
    }
  });

  return standings;
}
