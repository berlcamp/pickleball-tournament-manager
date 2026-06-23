import type { FinalBracketType } from "@/types";

export interface QualifierSlot {
  /** Display label of where the team came from, e.g. "A1" (Group A, 1st). */
  label: string;
  participantId: string | null;
  groupIndex: number;
  /** Rank within the group (1-based). */
  position: number;
  /** Overall seed across all groups (1-based, 1 = best record). */
  overallSeed: number;
}

export interface BracketMatch {
  round: number; // 1-based, 1 = first round
  slot: number; // 0-based position within the round
  label: string;
  participant1Id: string | null;
  participant2Id: string | null;
  /** Where each side comes from: a qualifier label or "W{round}.{slot}". */
  source1: string;
  source2: string;
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

/** Build a single-elimination bracket from slots already in bracket order. */
function buildSingleElim(orderedSlots: (QualifierSlot | null)[]): BracketMatch[] {
  const size = nextPow2(orderedSlots.length);
  const slots: (QualifierSlot | null)[] = [...orderedSlots];
  while (slots.length < size) slots.push(null);

  const matches: BracketMatch[] = [];
  const totalRounds = Math.log2(size);

  for (let r = 1; r <= totalRounds; r++) {
    const teamsInRound = size / Math.pow(2, r - 1);
    const numMatches = teamsInRound / 2;
    for (let s = 0; s < numMatches; s++) {
      let p1: string | null = null;
      let p2: string | null = null;
      let src1: string;
      let src2: string;

      if (r === 1) {
        const a = slots[2 * s];
        const b = slots[2 * s + 1];
        p1 = a?.participantId ?? null;
        p2 = b?.participantId ?? null;
        src1 = a?.label ?? "BYE";
        src2 = b?.label ?? "BYE";
      } else {
        src1 = `W${r - 1}.${2 * s}`;
        src2 = `W${r - 1}.${2 * s + 1}`;
      }

      matches.push({
        round: r,
        slot: s,
        label: numMatches === 1 ? roundLabel(2) : `${roundLabel(teamsInRound)} ${s + 1}`,
        participant1Id: p1,
        participant2Id: p2,
        source1: src1,
        source2: src2,
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
    });
  }

  return matches;
}

/** Crossover ordering: pair adjacent groups (A/B, C/D, ...). */
function crossoverOrder(qualifiers: QualifierSlot[]): (QualifierSlot | null)[] {
  const byGroup = new Map<number, QualifierSlot[]>();
  for (const q of qualifiers) {
    if (!byGroup.has(q.groupIndex)) byGroup.set(q.groupIndex, []);
    byGroup.get(q.groupIndex)!.push(q);
  }
  for (const list of byGroup.values()) list.sort((a, b) => a.position - b.position);

  const groupIndexes = [...byGroup.keys()].sort((a, b) => a - b);
  const ordered: (QualifierSlot | null)[] = [];

  for (let i = 0; i < groupIndexes.length; i += 2) {
    const gA = byGroup.get(groupIndexes[i]) ?? [];
    const gB = byGroup.get(groupIndexes[i + 1]) ?? [];
    // A1 vs B2, then B1 vs A2
    ordered.push(gA[0] ?? null, gB[1] ?? null);
    ordered.push(gB[0] ?? null, gA[1] ?? null);
  }

  return ordered;
}

/** Standard seed ordering: place qualifiers by overall seed into bracket. */
function standardOrder(qualifiers: QualifierSlot[]): (QualifierSlot | null)[] {
  const size = nextPow2(qualifiers.length);
  const bySeed = new Map<number, QualifierSlot>();
  qualifiers.forEach((q) => bySeed.set(q.overallSeed, q));
  return standardSeedOrder(size).map((seed) => bySeed.get(seed) ?? null);
}

export function generateFinalBracket(
  qualifiers: QualifierSlot[],
  type: FinalBracketType,
): BracketMatch[] {
  if (qualifiers.length < 2) return [];
  const ordered =
    type === "crossover" ? crossoverOrder(qualifiers) : standardOrder(qualifiers);
  return buildSingleElim(ordered);
}
