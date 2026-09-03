import { aggregateStatus, publicClient } from "@/lib/data";
import type { Profile, Tournament, TournamentStatus } from "@/types";

/** A row of the super admin's system-wide tournament list. */
export interface AdminTournament extends Tournament {
  /** Rolled up from the categories, same as the personal dashboard. */
  status: TournamentStatus;
  categoryCount: number;
  participantCount: number;
  ownerName: string | null;
  ownerEmail: string | null;
}

/**
 * Every tournament in the system, newest first.
 *
 * Read through `publicClient()` because the super admin is typically not a
 * member of most of these, and the members-only RLS policy would hide their
 * owners. Without `SUPABASE_SERVICE_ROLE_KEY` the list still renders — the
 * tournaments themselves are publicly readable — but the owner column is blank
 * for tournaments the viewer doesn't belong to. Callers must gate on
 * `requireSuperAdmin()` first.
 */
export async function getAllTournaments(): Promise<AdminTournament[]> {
  const supabase = await publicClient();

  const { data: rows } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });
  const tournaments = (rows ?? []) as Tournament[];
  if (tournaments.length === 0) return [];

  const ids = tournaments.map((t) => t.id);

  // Three fan-out queries rather than N per tournament.
  const [{ data: cats }, { data: parts }, { data: owners }] = await Promise.all([
    supabase.from("categories").select("tournament_id, status").in("tournament_id", ids),
    supabase.from("participants").select("tournament_id").in("tournament_id", ids),
    supabase
      .from("tournament_members")
      .select("tournament_id, user_id")
      .eq("role", "owner")
      .in("tournament_id", ids),
  ]);

  const statuses = new Map<string, TournamentStatus[]>();
  for (const c of cats ?? []) {
    const list = statuses.get(c.tournament_id) ?? [];
    list.push(c.status as TournamentStatus);
    statuses.set(c.tournament_id, list);
  }

  const teams = new Map<string, number>();
  for (const p of parts ?? []) {
    teams.set(p.tournament_id, (teams.get(p.tournament_id) ?? 0) + 1);
  }

  const ownerByTournament = new Map<string, string>();
  for (const m of owners ?? []) ownerByTournament.set(m.tournament_id, m.user_id);

  const ownerIds = [...new Set(ownerByTournament.values())];
  const profiles = new Map<string, Profile>();
  if (ownerIds.length) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .in("id", ownerIds);
    for (const p of (data ?? []) as Profile[]) profiles.set(p.id, p);
  }

  return tournaments.map((t) => {
    const owner = profiles.get(ownerByTournament.get(t.id) ?? "");
    return {
      ...t,
      status: aggregateStatus(statuses.get(t.id) ?? []),
      categoryCount: statuses.get(t.id)?.length ?? 0,
      participantCount: teams.get(t.id) ?? 0,
      ownerName: owner?.full_name ?? null,
      ownerEmail: owner?.email ?? null,
    };
  });
}
