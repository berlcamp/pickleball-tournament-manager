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
import { generateFinalBracket, type QualifierSlot } from "@/services/brackets";
import { ADVANCE_PER_GROUP } from "@/lib/constants";

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
      "id, round, slot, label, participant1_id, participant2_id, source1, source2, status, winner_id",
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
        // An empty side is a bye, not a team still to be decided.
        name: m.source1 === "BYE" ? "Bye" : nm(m.participant1_id),
        seed: seed(m.participant1_id),
      },
      team2: {
        id: m.participant2_id,
        name: m.source2 === "BYE" ? "Bye" : nm(m.participant2_id),
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

/** "1st", "2nd", "3rd"… for a qualifying position within a group. */
function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * Draw the bracket a category *will* get, before its group stage has finished.
 *
 * Nobody has qualified yet, so every slot holds a placeholder — "A1" is
 * whoever finishes first in Group A. The groups are ordered against each other
 * by their current leaders' records, so the draw tracks the standings as they
 * move and converges on the real one; before any score it falls back to group
 * order. Read-only: it writes nothing, and the bracket that counts is drawn by
 * `generateFinals` when the stage ends.
 */
export async function loadFinalsPreview(
  db: DB,
  categoryId: string,
): Promise<BracketRound[]> {
  const [{ data: groups }, { data: standings }] = await Promise.all([
    db
      .from("groups")
      .select("id, position, group_members(participant_id)")
      .eq("category_id", categoryId)
      .order("position"),
    db
      .from("standings")
      .select(
        "group_id, rank, matches_won, matches_lost, matches_tied, points, point_diff",
      )
      .eq("category_id", categoryId),
  ]);
  if (!groups || groups.length === 0) return [];

  const rows = groups as unknown as {
    id: string;
    position: number;
    group_members: { participant_id: string }[];
  }[];

  const qualifiers: QualifierSlot[] = [];
  const nameByLabel = new Map<string, string>();
  for (const g of rows) {
    // Ordering the groups against each other needs their leaders' current
    // records; with no scores in yet they are all zero and `rankQualifiers`
    // falls back to group order, which is the shape we want to show anyway.
    const table = (standings ?? [])
      .filter((s) => s.group_id === g.id)
      .sort((a, b) => a.rank - b.rank)
      .slice(0, ADVANCE_PER_GROUP);
    const advancing = Math.max(
      table.length,
      Math.min(g.group_members?.length ?? 0, ADVANCE_PER_GROUP),
    );

    for (let position = 1; position <= advancing; position++) {
      const label = `${groupLabel(g.position)}${position}`;
      nameByLabel.set(
        label,
        `${ordinal(position)} · Group ${groupLabel(g.position)}`,
      );
      const s = table[position - 1];
      qualifiers.push({
        label,
        participantId: null,
        groupIndex: g.position,
        position,
        record: {
          matchesWon: s?.matches_won ?? 0,
          matchesPlayed: s
            ? s.matches_won + s.matches_lost + s.matches_tied
            : 0,
          pointDiff: s?.point_diff ?? 0,
          points: s?.points ?? 0,
        },
      });
    }
  }
  if (qualifiers.length < 2) return [];

  const bracket = generateFinalBracket(qualifiers);

  // A later round's slot is fed by an earlier match: name it after that match
  // ("Winner of Quarterfinal 2") rather than showing a raw W1.1 reference.
  for (const m of bracket) {
    nameByLabel.set(`W${m.round}.${m.slot}`, `Winner of ${m.label}`);
    nameByLabel.set(`L${m.round}.${m.slot}`, `Loser of ${m.label}`);
  }

  const side = (source: string) => ({
    id: null,
    name: source === "BYE" ? "Bye" : (nameByLabel.get(source) ?? source),
    seed: /^[A-Z]+\d+$/.test(source) ? source : null,
  });

  const byRound = new Map<number, FinalMatchVM[]>();
  for (const m of bracket) {
    if (!byRound.has(m.round)) byRound.set(m.round, []);
    byRound.get(m.round)!.push({
      id: `preview-${m.round}-${m.slot}`,
      round: m.round,
      slot: m.slot,
      label: m.label,
      team1: side(m.source1),
      team2: side(m.source2),
      status: "pending",
      winnerId: null,
      sets: [],
    });
  }

  return [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, ms]) => ({
      round,
      matches: ms.sort((a, b) => a.slot - b.slot),
    }));
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
      "id, category_id, match_type, match_id, label, scheduled_time, scheduled_date, status, queued, court_id",
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

  // Reserved knockout slots aren't linked to real bracket matches, but once the
  // finals are generated the teams become known. Match them back by
  // (category, round label) — labels are unique within a category's bracket.
  const { data: finalMatches } = await db
    .from("final_matches")
    .select("category_id, label, participant1_id, participant2_id")
    .eq("tournament_id", tournamentId);
  const finalByKey = new Map<
    string,
    { participant1_id: string | null; participant2_id: string | null }
  >();
  (finalMatches ?? []).forEach((m) => {
    if (m.label)
      finalByKey.set(`${m.category_id}|${m.label}`, {
        participant1_id: m.participant1_id,
        participant2_id: m.participant2_id,
      });
  });

  return schedules.map((s) => {
    const court = s.court_id ? (courtName.get(s.court_id) ?? "—") : "—";
    const category = s.category_id
      ? (categoryNameById.get(s.category_id) ?? null)
      : null;
    const venue = s.category_id ? (venueById.get(s.category_id) ?? null) : null;
    if (s.match_type === "knockout") {
      // Reserved bracket slot — teams may not be known yet. Once the finals are
      // generated, match this slot back to the real bracket match by its round
      // label and fill in the actual team names.
      const fm =
        s.category_id && s.label
          ? finalByKey.get(`${s.category_id}|${s.label}`)
          : undefined;
      return {
        id: s.id,
        time: s.scheduled_time,
        date: s.scheduled_date,
        court,
        category,
        venue,
        team1: fm?.participant1_id
          ? (nameById.get(fm.participant1_id) ?? "TBD")
          : "TBD",
        team2: fm?.participant2_id
          ? (nameById.get(fm.participant2_id) ?? "TBD")
          : "TBD",
        group: s.label ?? "Knockout",
        status: s.status,
        queued: s.queued,
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
      queued: s.queued,
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
