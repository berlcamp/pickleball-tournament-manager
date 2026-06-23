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
 * Snake (serpentine) seeding. With N groups, seeds are distributed:
 * Round 1: G0 G1 G2 ...   Round 2: ...G2 G1 G0   etc.
 * This balances strength across groups.
 *
 * `seeded` must be ordered by seed ascending (seed 1 = strongest).
 */
export function snakeAssignGroups(
  seeded: SeededParticipant[],
  numGroups: number,
): GroupAssignment[] {
  const groups: GroupAssignment[] = Array.from(
    { length: numGroups },
    (_, i) => ({ groupIndex: i, members: [] }),
  );

  const ordered = [...seeded].sort((a, b) => a.seed - b.seed);

  ordered.forEach((p, index) => {
    const round = Math.floor(index / numGroups);
    const posInRound = index % numGroups;
    const groupIndex =
      round % 2 === 0 ? posInRound : numGroups - 1 - posInRound;
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
