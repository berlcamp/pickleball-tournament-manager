import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { CategorySettings, StandingStatus } from "@/types";
import type { GroupVM } from "@/components/tournament/group-stage-view";
import type { ScheduleRow } from "@/components/tournament/schedule-table";
import type {
  BracketRound,
  FinalMatchVM,
} from "@/components/tournament/bracket-view";
import { groupLabel } from "@/services/seeding";

type DB = SupabaseClient<Database>;

export interface PlacementVM {
  placement: string;
  name: string | null;
}

/** Build a category's finals bracket grouped into rounds, plus placements. */
export async function loadFinals(
  db: DB,
  categoryId: string,
): Promise<{ rounds: BracketRound[]; placements: PlacementVM[] }> {
  const { data: participants } = await db
    .from("participants")
    .select("id, name")
    .eq("category_id", categoryId);
  const nameById = new Map<string, string>();
  (participants ?? []).forEach((p) => nameById.set(p.id, p.name));
  const nm = (id: string | null) => (id ? (nameById.get(id) ?? "TBD") : "TBD");

  // Seed label per participant from group standings, e.g. "A2" (Group A, rank 2).
  const [{ data: groups }, { data: seedStandings }] = await Promise.all([
    db.from("groups").select("id, position").eq("category_id", categoryId),
    db
      .from("standings")
      .select("participant_id, group_id, rank")
      .eq("category_id", categoryId),
  ]);
  const posByGroup = new Map<string, number>();
  (groups ?? []).forEach((g) => posByGroup.set(g.id, g.position));
  const seedById = new Map<string, string>();
  (seedStandings ?? []).forEach((s) => {
    const pos = posByGroup.get(s.group_id);
    if (pos != null)
      seedById.set(s.participant_id, `${groupLabel(pos)}${s.rank}`);
  });
  const seed = (id: string | null) => (id ? (seedById.get(id) ?? null) : null);

  const { data: matches } = await db
    .from("final_matches")
    .select(
      "id, round, slot, label, participant1_id, participant2_id, status, winner_id",
    )
    .eq("category_id", categoryId)
    .order("round")
    .order("slot");

  const ids = (matches ?? []).map((m) => m.id);
  const { data: scores } = ids.length
    ? await db
        .from("match_scores")
        .select(
          "final_match_id, set_number, participant1_score, participant2_score",
        )
        .in("final_match_id", ids)
        .order("set_number")
    : { data: [] as never[] };
  const scoresByMatch = new Map<
    string,
    { participant1_score: number; participant2_score: number }[]
  >();
  (scores ?? []).forEach((s) => {
    if (!scoresByMatch.has(s.final_match_id))
      scoresByMatch.set(s.final_match_id, []);
    scoresByMatch.get(s.final_match_id)!.push({
      participant1_score: s.participant1_score,
      participant2_score: s.participant2_score,
    });
  });

  const byRound = new Map<number, FinalMatchVM[]>();
  for (const m of matches ?? []) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push({
      id: m.id,
      round: m.round,
      slot: m.slot,
      label: m.label ?? "Match",
      team1: {
        id: m.participant1_id,
        name: nm(m.participant1_id),
        seed: seed(m.participant1_id),
      },
      team2: {
        id: m.participant2_id,
        name: nm(m.participant2_id),
        seed: seed(m.participant2_id),
      },
      status: m.status,
      winnerId: m.winner_id,
      sets: scoresByMatch.get(m.id) ?? [],
    });
  }

  const rounds: BracketRound[] = [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, ms]) => ({
      round,
      matches: ms.sort((a, b) => a.slot - b.slot),
    }));

  const { data: placements } = await db
    .from("placements")
    .select("placement, participant_id")
    .eq("category_id", categoryId);
  const placementVMs: PlacementVM[] = (placements ?? []).map((p) => ({
    placement: p.placement,
    name: p.participant_id ? nm(p.participant_id) : null,
  }));

  return { rounds, placements: placementVMs };
}

/**
 * Build schedule rows (time / court / match / group / category / status) for the
 * whole tournament (shared venue). Pass `categoryId` to filter to one category;
 * omit it for the combined "All categories" view.
 */
export async function loadSchedule(
  db: DB,
  tournamentId: string,
  categoryId?: string,
): Promise<ScheduleRow[]> {
  let scheduleQuery = db
    .from("match_schedules")
    .select(
      "id, category_id, match_type, match_id, label, scheduled_time, scheduled_date, status, court_id",
    )
    .eq("tournament_id", tournamentId)
    .in("match_type", ["group", "knockout"]);
  if (categoryId) scheduleQuery = scheduleQuery.eq("category_id", categoryId);
  const { data: schedules } = await scheduleQuery;
  if (!schedules || schedules.length === 0) return [];

  const { data: courts } = await db
    .from("courts")
    .select("id, name")
    .eq("tournament_id", tournamentId);
  const courtName = new Map<string, string>();
  (courts ?? []).forEach((c) => courtName.set(c.id, c.name));

  const { data: categories } = await db
    .from("categories")
    .select("id, name, settings")
    .eq("tournament_id", tournamentId);
  const categoryNameById = new Map<string, string>();
  const venueById = new Map<string, string>();
  (categories ?? []).forEach((c) => {
    categoryNameById.set(c.id, c.name);
    const venue = (c.settings as CategorySettings | null)?.venue_name;
    if (venue) venueById.set(c.id, venue);
  });

  const { data: groups } = await db
    .from("groups")
    .select("id, name")
    .eq("tournament_id", tournamentId);
  const groupName = new Map<string, string>();
  (groups ?? []).forEach((g) => groupName.set(g.id, g.name));

  const { data: participants } = await db
    .from("participants")
    .select("id, name")
    .eq("tournament_id", tournamentId);
  const nameById = new Map<string, string>();
  (participants ?? []).forEach((p) => nameById.set(p.id, p.name));

  const { data: matches } = await db
    .from("group_matches")
    .select("id, group_id, participant1_id, participant2_id, status")
    .eq("tournament_id", tournamentId);
  const matchById = new Map(
    (matches ?? []).map((m) => [m.id, m]),
  );

  return schedules.map((s) => {
    const court = s.court_id ? (courtName.get(s.court_id) ?? "—") : "—";
    const category = s.category_id
      ? (categoryNameById.get(s.category_id) ?? null)
      : null;
    const venue = s.category_id ? (venueById.get(s.category_id) ?? null) : null;
    if (s.match_type === "knockout") {
      // Reserved bracket slot — teams aren't known yet; the label is the round.
      return {
        id: s.id,
        time: s.scheduled_time,
        date: s.scheduled_date,
        court,
        category,
        venue,
        team1: "TBD",
        team2: "TBD",
        group: s.label ?? "Knockout",
        status: s.status,
        kind: "knockout" as const,
      };
    }
    const m = matchById.get(s.match_id);
    return {
      id: s.id,
      time: s.scheduled_time,
      date: s.scheduled_date,
      court,
      category,
      venue,
      team1: m?.participant1_id
        ? (nameById.get(m.participant1_id) ?? "TBD")
        : "TBD",
      team2: m?.participant2_id
        ? (nameById.get(m.participant2_id) ?? "TBD")
        : "TBD",
      group: m?.group_id ? (groupName.get(m.group_id) ?? "—") : "—",
      status: m?.status ?? s.status,
      kind: "group" as const,
    };
  });
}

/** Build a category's group-stage view model (groups, matches, standings). */
export async function loadGroupStage(
  db: DB,
  categoryId: string,
): Promise<GroupVM[]> {
  const { data: participants } = await db
    .from("participants")
    .select("id, name")
    .eq("category_id", categoryId);
  const nameById = new Map<string, string>();
  (participants ?? []).forEach((p) => nameById.set(p.id, p.name));
  const nm = (id: string | null) => (id ? (nameById.get(id) ?? "TBD") : "TBD");

  const { data: groups } = await db
    .from("groups")
    .select("id, name, position")
    .eq("category_id", categoryId)
    .order("position");
  if (!groups || groups.length === 0) return [];

  const { data: matches } = await db
    .from("group_matches")
    .select(
      "id, group_id, round, participant1_id, participant2_id, status, winner_id",
    )
    .eq("category_id", categoryId)
    .order("round")
    .order("id");

  const matchIds = (matches ?? []).map((m) => m.id);
  const { data: scores } = matchIds.length
    ? await db
        .from("group_match_scores")
        .select(
          "match_id, set_number, participant1_score, participant2_score",
        )
        .in("match_id", matchIds)
        .order("set_number")
    : { data: [] as never[] };

  const scoresByMatch = new Map<
    string,
    { participant1_score: number; participant2_score: number }[]
  >();
  (scores ?? []).forEach((s) => {
    if (!scoresByMatch.has(s.match_id)) scoresByMatch.set(s.match_id, []);
    scoresByMatch.get(s.match_id)!.push({
      participant1_score: s.participant1_score,
      participant2_score: s.participant2_score,
    });
  });

  const { data: standings } = await db
    .from("standings")
    .select("*")
    .eq("category_id", categoryId);

  return groups.map((g) => ({
    id: g.id,
    name: g.name,
    matches: (matches ?? [])
      .filter((m) => m.group_id === g.id)
      .map((m) => ({
        id: m.id,
        round: m.round,
        team1: { id: m.participant1_id, name: nm(m.participant1_id) },
        team2: { id: m.participant2_id, name: nm(m.participant2_id) },
        status: m.status,
        winnerId: m.winner_id,
        sets: scoresByMatch.get(m.id) ?? [],
      })),
    standings: (standings ?? [])
      .filter((s) => s.group_id === g.id)
      .sort((a, b) => a.rank - b.rank)
      .map((s) => ({
        participantId: s.participant_id,
        rank: s.rank,
        status: s.status as StandingStatus,
        name: nm(s.participant_id),
        matchesWon: s.matches_won,
        matchesLost: s.matches_lost,
        matchesTied: s.matches_tied,
        tieBreak: s.tie_break,
        setWins: s.set_wins,
        setTies: s.set_ties,
        points: s.points,
        pointDiff: s.point_diff,
        history: (s.history as ("W" | "L" | "T")[]) ?? [],
      })),
  }));
}
