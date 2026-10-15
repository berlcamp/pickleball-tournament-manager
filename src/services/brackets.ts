/**
 * Finals bracket construction.
 *
 * The tournament runs in two stages, Challonge-style: a round-robin group
 * stage, then a single-elimination final stage. The top `ADVANCE_PER_GROUP`
 * teams from every group qualify, are ranked into one overall order across
 * all groups, and are dropped into a standard-seeded knockout bracket — best
 * seed against weakest, so the two strongest qualifiers can only meet in the
 * final. There is no second bracket style to choose from.
 *
 * Group winners are seeded first, then runners-up, each tier ranked on its own
 * results (see `rankQualifiers`). Two teams out of the same group never meet
 * again in round one — they already played each other in the group stage —
 * which `avoidSameGroupFirstRound` repairs after seeding.
 */

/** A qualifier's group-stage record, used to rank it against other groups. */
export interface QualifierRecord {
  matchesWon: number;
  /** Wins + losses + ties. Groups can differ in size, so this is the
   *  denominator that makes win rate comparable across groups. */
  matchesPlayed: number;
  pointDiff: number;
  points: number;
}

export interface QualifierSlot {
  /** Display label of where the team came from, e.g. "A1" (Group A, 1st). */
  label: string;
  participantId: string | null;
  groupIndex: number;
  /** Rank within the group (1-based). */
  position: number;
  record: QualifierRecord;
}

export interface RankedQualifier extends QualifierSlot {
  /** Overall seed across all groups (1-based, 1 = best). */
  overallSeed: number;
}

export interface BracketMatch {
  round: number; // 1-based, 1 = first round
  slot: number; // 0-based position within the round
  label: string;
  participant1Id: string | null;
  participant2Id: string | null;
  /** Where each side comes from: a qualifier label, "BYE", or "W{round}.{slot}". */
  source1: string;
  source2: string;
  /** One side is a BYE: nothing to play, the other side walks over. */
  bye: boolean;
  /** Decided at generation time for walkovers only; null until played. */
  winnerId: string | null;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

export function roundLabel(teamsInRound: number): string {
  switch (teamsInRound) {
    case 2:
      return "Final";
    case 4:
      return "Semifinal";
    case 8:
      return "Quarterfinal";
    default:
      return `Round of ${teamsInRound}`;
  }
}

/** Standard single-elimination seeding order for a bracket of size n (pow2). */
export function standardSeedOrder(n: number): number[] {
  let res = [1, 2];
  while (res.length < n) {
    const sum = res.length * 2 + 1;
    const next: number[] = [];
    for (const r of res) {
      next.push(r);
      next.push(sum - r);
    }
    res = next;
  }
  return res;
}

function winRate(r: QualifierRecord): number {
  return r.matchesPlayed > 0 ? r.matchesWon / r.matchesPlayed : 0;
}

/**
 * Order two qualifiers from the same placement tier on their own group-stage
 * results: win *rate* (groups can differ in size, and a bigger group would
 * otherwise hand out more wins for the same performance), then point
 * differential, then points. The last resort is the group index, not a coin
 * flip: regenerating a bracket must produce the same draw every time, and
 * unlike group standings there is no further match left in which to settle it.
 */
function compareRecords(a: QualifierSlot, b: QualifierSlot): number {
  return (
    winRate(b.record) - winRate(a.record) ||
    b.record.pointDiff - a.record.pointDiff ||
    b.record.points - a.record.points ||
    a.groupIndex - b.groupIndex
  );
}

/**
 * Rank every qualifier into one overall order across all groups.
 *
 * Placement comes first: every group winner is seeded above every runner-up,
 * every runner-up above every third place, and so on. Within a tier, teams are
 * ranked on their own records (`compareRecords`) — the way most pickleball
 * tournament directors seed a pool-play knockout, so a 2-1 runner-up is always
 * seeded above a 1-2 one.
 *
 * This replaced Challonge's rule, where a runner-up inherited its seed from
 * how its group *winner* placed. That rule kept a group's two qualifiers apart
 * structurally; here `avoidSameGroupFirstRound` does that job instead.
 */
export function rankQualifiers(qualifiers: QualifierSlot[]): RankedQualifier[] {
  return [...qualifiers]
    .sort((a, b) => a.position - b.position || compareRecords(a, b))
    .map((q, i) => ({ ...q, overallSeed: i + 1 }));
}

/** Place ranked qualifiers into bracket order, leaving byes for the top seeds. */
function seedIntoBracket(ranked: RankedQualifier[]): (RankedQualifier | null)[] {
  const size = nextPow2(ranked.length);
  const bySeed = new Map<number, RankedQualifier>();
  ranked.forEach((q) => bySeed.set(q.overallSeed, q));
  return standardSeedOrder(size).map((seed) => bySeed.get(seed) ?? null);
}

/**
 * Keep teams from the same group apart in round one.
 *
 * Strict seeding pairs seed N with seed (size + 1 - N), which regularly lands
 * a group's winner against its own runner-up now that runners-up are ranked
 * on their own records. Every such clash is repaired here.
 *
 * The repair is a single exchange of opponents between two round-one
 * matches, chosen to move the seeding as little as possible: of every swap
 * that clears the clash without creating a new one, take the one between the
 * closest-ranked teams. Byes are never moved — a bye is the top seeds'
 * reward and shuffling it would cost more fairness than the rematch does.
 *
 * If no legal swap exists (a very small field where every team shares a
 * group with someone), the clash is left alone rather than forced.
 */
function avoidSameGroupFirstRound(
  ordered: (RankedQualifier | null)[],
): (RankedQualifier | null)[] {
  const slots = [...ordered];
  const numMatches = slots.length / 2;
  const opposite = (slot: number) => (slot % 2 === 0 ? slot + 1 : slot - 1);
  const clash = (m: number) => {
    const a = slots[2 * m];
    const b = slots[2 * m + 1];
    return a !== null && b !== null && a.groupIndex === b.groupIndex;
  };

  for (let m = 0; m < numMatches; m++) {
    if (!clash(m)) continue;

    // Move the weaker of the two clashing teams first: the better seed keeps
    // the opponent its group-stage record earned.
    const sides = [2 * m, 2 * m + 1].sort(
      (a, b) => (slots[b]?.overallSeed ?? 0) - (slots[a]?.overallSeed ?? 0),
    );

    let best: { from: number; to: number; cost: number } | null = null;
    for (const from of sides) {
      for (let other = 0; other < numMatches; other++) {
        if (other === m) continue;
        for (const to of [2 * other, 2 * other + 1]) {
          const moving = slots[from];
          const target = slots[to];
          if (!moving || !target) continue;
          const staysHere = slots[opposite(from)];
          const staysThere = slots[opposite(to)];
          // Never swap into a bye match: that would hand the walkover to a
          // team that didn't earn it. (A bye match never clashes, so the
          // team being moved is never sitting in one.)
          if (staysThere === null) continue;
          // The swap has to leave *both* matches clean.
          if (staysHere && target.groupIndex === staysHere.groupIndex) continue;
          if (staysThere && moving.groupIndex === staysThere.groupIndex) continue;
          const cost = Math.abs(moving.overallSeed - target.overallSeed);
          if (!best || cost < best.cost) best = { from, to, cost };
        }
      }
    }

    if (best) {
      const held = slots[best.from];
      slots[best.from] = slots[best.to];
      slots[best.to] = held;
    }
  }

  return slots;
}

/** What a match feeds forward: whether the branch is empty, and who advances. */
interface Feed {
  empty: boolean;
  participantId: string | null;
}

/** Build a single-elimination bracket from slots already in bracket order. */
function buildSingleElim(
  orderedSlots: (RankedQualifier | null)[],
): BracketMatch[] {
  const size = nextPow2(orderedSlots.length);
  const slots: (RankedQualifier | null)[] = [...orderedSlots];
  while (slots.length < size) slots.push(null);

  const matches: BracketMatch[] = [];
  const totalRounds = Math.log2(size);
  // "W{round}.{slot}" -> what that match sends into the next round.
  const feeds = new Map<string, Feed>();

  for (let r = 1; r <= totalRounds; r++) {
    const teamsInRound = size / Math.pow(2, r - 1);
    const numMatches = teamsInRound / 2;
    for (let s = 0; s < numMatches; s++) {
      let side1: Feed;
      let side2: Feed;
      let src1: string;
      let src2: string;

      if (r === 1) {
        const a = slots[2 * s];
        const b = slots[2 * s + 1];
        side1 = { empty: a === null, participantId: a?.participantId ?? null };
        side2 = { empty: b === null, participantId: b?.participantId ?? null };
        src1 = a?.label ?? "BYE";
        src2 = b?.label ?? "BYE";
      } else {
        src1 = `W${r - 1}.${2 * s}`;
        src2 = `W${r - 1}.${2 * s + 1}`;
        side1 = feeds.get(src1) ?? { empty: true, participantId: null };
        side2 = feeds.get(src2) ?? { empty: true, participantId: null };
      }

      // A side with no opponent walks over: the match is settled the moment
      // the bracket is drawn, and the survivor is pushed into the next round.
      const bye = side1.empty !== side2.empty;
      const walkover = bye ? (side1.empty ? side2 : side1).participantId : null;

      matches.push({
        round: r,
        slot: s,
        label:
          numMatches === 1 ? roundLabel(2) : `${roundLabel(teamsInRound)} ${s + 1}`,
        participant1Id: side1.participantId,
        participant2Id: side2.participantId,
        source1: src1,
        source2: src2,
        bye,
        winnerId: walkover,
      });

      feeds.set(`W${r}.${s}`, {
        empty: side1.empty && side2.empty,
        participantId: walkover,
      });
    }
  }

  // Third-place playoff between the two semifinal losers (when a semifinal
  // round exists).
  if (size >= 4) {
    const semiRound = totalRounds - 1;
    matches.push({
      round: totalRounds, // same round as the final
      slot: 1,
      label: "Third Place",
      participant1Id: null,
      participant2Id: null,
      source1: `L${semiRound}.0`,
      source2: `L${semiRound}.1`,
      bye: false,
      winnerId: null,
    });
  }

  return matches;
}

/**
 * Rank the qualifiers and draw the single-elimination final stage.
 * Returns an empty bracket when fewer than two teams qualified.
 */
export function generateFinalBracket(
  qualifiers: QualifierSlot[],
): BracketMatch[] {
  if (qualifiers.length < 2) return [];
  const seeded = seedIntoBracket(rankQualifiers(qualifiers));
  return buildSingleElim(avoidSameGroupFirstRound(seeded));
}
