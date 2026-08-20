/**
 * Seeding + group assignment algorithms.
 */

/** Fisher-Yates shuffle (returns a new array). */
export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export interface SeededParticipant {
  id: string;
  seed: number; // 1-based
}

export interface GroupAssignment {
  groupIndex: number; // 0-based
  members: { participantId: string; seedInGroup: number }[];
}

/**
 * Distribute seeded participants across groups, Challonge-style.
 *
 * Groups are taken two at a time — (A,B), (C,D), (E,F) … — and each pair is
 * filled in alternating direction: the direction flips from one pair to the
 * next, and flips again on every pass through the groups. Reverse-engineered
 * from Challonge's automatic assignment, where 16 seeds across 8 groups
 * produced:
 *
 *   seeds 1-8   ->  A B D C E F H G
 *   seeds 9-16  ->  B A C D F E G H   (the same order, pairs swapped)
 *
 * Note this is deliberately NOT a plain serpentine. A serpentine balances
 * every group to the same seed total; this does not — the first pair of
 * groups draws the strongest teams and the last pair the weakest. That is
 * Challonge's behaviour and it is what this project matches on purpose; see
 * `rankQualifiers` in services/brackets.ts, which pairs groups the same way.
 *
 * `seeded` must be ordered by seed ascending (seed 1 = strongest).
 */
export function assignGroups(
  seeded: SeededParticipant[],
  numGroups: number,
): GroupAssignment[] {
  const groups: GroupAssignment[] = Array.from(
    { length: numGroups },
    (_, i) => ({ groupIndex: i, members: [] }),
  );

  const ordered = [...seeded].sort((a, b) => a.seed - b.seed);

  ordered.forEach((p, index) => {
    const pass = Math.floor(index / numGroups);
    const slot = index % numGroups;
    const pair = Math.floor(slot / 2);
    const withinPair = slot % 2;

    let groupIndex: number;
    if (pair * 2 + 1 >= numGroups) {
      // An odd group count leaves a final group with no partner to alternate
      // against; it just takes the slot directly.
      groupIndex = slot;
    } else {
      const forward = (pair + pass) % 2 === 0;
      groupIndex = pair * 2 + (forward ? withinPair : 1 - withinPair);
    }

    groups[groupIndex].members.push({
      participantId: p.id,
      seedInGroup: groups[groupIndex].members.length + 1,
    });
  });

  return groups;
}

/** Group label from index: 0 -> "A", 1 -> "B", ... 26 -> "AA" */
export function groupLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}
