/**
 * Round robin generation using the circle method, so every team plays
 * every other team once, spread across balanced rounds.
 */
export interface RRMatch {
  round: number; // 1-based
  participant1Id: string | null;
  participant2Id: string | null;
}

export function generateRoundRobin(participantIds: string[]): RRMatch[] {
  const ids: (string | null)[] = [...participantIds];
  // Odd number of teams -> add a "bye" placeholder.
  if (ids.length % 2 !== 0) ids.push(null);

  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const matches: RRMatch[] = [];

  // Fixed first element, rotate the rest.
  const arr = [...ids];
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      // Skip byes (a real team paired with null still gets recorded so the
      // scheduler/standings can show the bye), but only record real pairings.
      if (home !== null && away !== null) {
        matches.push({
          round: r + 1,
          participant1Id: home,
          participant2Id: away,
        });
      }
    }
    // rotate (keep arr[0] fixed)
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop() as string | null);
    arr.splice(0, arr.length, fixed, ...rest);
  }

  return matches;
}
