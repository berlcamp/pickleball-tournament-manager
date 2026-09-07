import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { Category, Role, Tournament, TournamentStatus } from "@/types";

export interface MyTournament extends Tournament {
  role: Role;
  /** Aggregate status derived from the tournament's categories. */
  status: TournamentStatus;
  categoryCount: number;
}

const STATUS_RANK: Record<TournamentStatus, number> = {
  draft: 0,
  group_stage: 1,
  final_stage: 2,
  completed: 3,
};
const RANK_STATUS: TournamentStatus[] = [
  "draft",
  "group_stage",
  "final_stage",
  "completed",
];

/**
 * Roll a tournament's per-category statuses into one indicator: "completed"
 * only when every category is done, otherwise the furthest active stage reached
 * (capped below "completed" so an in-progress tournament never reads as done).
 */
export function aggregateStatus(
  statuses: TournamentStatus[],
): TournamentStatus {
  if (statuses.length === 0) return "draft";
  if (statuses.every((s) => s === "completed")) return "completed";
  const maxRank = Math.min(
    2,
    Math.max(...statuses.map((s) => STATUS_RANK[s])),
  );
  return RANK_STATUS[maxRank];
}

export async function getMyTournaments(): Promise<MyTournament[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: raw } = await supabase
    .from("tournament_members")
    .select("role, tournaments(*)")
    .eq("user_id", user.id);

  const data = (raw ?? []) as unknown as {
    role: Role;
    tournaments: Tournament | null;
  }[];

  const tournaments = data
    .filter((r) => r.tournaments)
    .map((r) => ({
      tournament: r.tournaments as unknown as Tournament,
      role: r.role as Role,
    }));

  // Pull category statuses for all of these tournaments in one query.
  const ids = tournaments.map((t) => t.tournament.id);
  const statusByTournament = new Map<string, TournamentStatus[]>();
  if (ids.length) {
    const { data: cats } = await supabase
      .from("categories")
      .select("tournament_id, status")
      .in("tournament_id", ids);
    for (const c of cats ?? []) {
      if (!statusByTournament.has(c.tournament_id))
        statusByTournament.set(c.tournament_id, []);
      statusByTournament.get(c.tournament_id)!.push(c.status as TournamentStatus);
    }
  }

  return tournaments
    .map(({ tournament, role }) => {
      const statuses = statusByTournament.get(tournament.id) ?? [];
      return {
        ...tournament,
        role,
        status: aggregateStatus(statuses),
        categoryCount: statuses.length,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

/** Service-role client used for public, no-login pages. Falls back to the
 * anon client (public RLS read policies) when no service key is configured. */
export async function publicClient() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return createServiceClient();
  return createClient();
}

/** Load a tournament, the current user's role, and its categories; null if not
 * a member. */
export async function getTournamentContext(id: string): Promise<{
  tournament: Tournament;
  role: Role;
  categories: Category[];
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: member } = await supabase
    .from("tournament_members")
    .select("role")
    .eq("tournament_id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return null;

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!tournament) return null;

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .eq("tournament_id", id)
    .order("position");

  return {
    tournament: tournament as Tournament,
    role: member.role as Role,
    categories: (categories ?? []) as Category[],
  };
}

/**
 * Resolve a tournament from whatever appears in a public URL: the short code
 * first, then the long slug. The fallback keeps every previously shared link
 * and printed QR code working after the move to short codes.
 *
 * Memoized per request: the portal layout and its `generateMetadata` both need
 * the tournament, and a link-preview crawler shouldn't cost two round trips.
 */
export const getTournamentByPublicRef = cache(async function (ref: string) {
  const supabase = await publicClient();
  const value = ref.trim().toLowerCase();

  const { data: byCode } = await supabase
    .from("tournaments")
    .select("*")
    .eq("short_code", value)
    .maybeSingle();
  if (byCode) return byCode as Tournament;

  const { data: bySlug } = await supabase
    .from("tournaments")
    .select("*")
    .eq("slug", value)
    .maybeSingle();
  return (bySlug as Tournament) ?? null;
});


/** Categories for a tournament, readable on public (no-login) pages. */
export async function getPublicCategories(
  tournamentId: string,
): Promise<Category[]> {
  const supabase = await publicClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("position");
  return (data ?? []) as Category[];
}

/** Pick the active category from a `?category=` value, defaulting to the first. */
export function resolveActiveCategory(
  categories: Category[],
  requested?: string,
): Category | undefined {
  return categories.find((c) => c.id === requested) ?? categories[0];
}

export async function getCategory(categoryId: string): Promise<Category | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("*")
    .eq("id", categoryId)
    .maybeSingle();
  return (data as Category) ?? null;
}

/** A finished tournament worth showing off on the marketing page. */
export interface ShowcaseTournament {
  id: string;
  name: string;
  short_code: string;
  location: string | null;
  banner: string | null;
  /** The day it was played: the tournament date, else the earliest category date. */
  date: string | null;
  /** `final_stage` or `completed` — never anything earlier. */
  status: Extract<TournamentStatus, "final_stage" | "completed">;
  teams: number;
  categories: number;
}

/** A tournament has to be at least this big to make the showcase. */
const SHOWCASE_MIN_TEAMS = 30;
/** How many make it onto the home page. */
const SHOWCASE_SIZE = 5;
/**
 * How many of the most recent finished tournaments we bother counting teams
 * for. Team counts cost one query each, so the list is trimmed by date first —
 * an older tournament that would have qualified is not "recent" anyway.
 */
const SHOWCASE_CANDIDATES = 24;

/** Newest first, by the day it was played (falling back to when it was made). */
const showcaseDate = (t: { start_date: string | null; created_at: string }) =>
  t.start_date ?? t.created_at;

/**
 * The five most recent sizeable tournaments that have reached their finals,
 * for the marquee on the marketing page. Public data only — it runs on the
 * public client so a logged-out visitor sees the same list.
 *
 * Returns an empty list on any failure: the marquee is decoration, and the
 * home page must never 500 because of it.
 */
export const loadShowcaseTournaments = cache(
  async function (): Promise<ShowcaseTournament[]> {
    try {
      const supabase = await publicClient();

      // Tournaments that got at least one category as far as the knockout.
      const { data: finished } = await supabase
        .from("categories")
        .select("tournament_id")
        .in("status", ["final_stage", "completed"]);
      const candidateIds = [
        ...new Set((finished ?? []).map((c) => c.tournament_id)),
      ];
      if (candidateIds.length === 0) return [];

      const { data: rows } = await supabase
        .from("tournaments")
        .select("id, name, short_code, location, start_date, banner, created_at")
        .in("id", candidateIds);

      const recent = ((rows ?? []) as {
        id: string;
        name: string;
        short_code: string;
        location: string | null;
        start_date: string | null;
        banner: string | null;
        created_at: string;
      }[])
        .sort((a, b) => showcaseDate(b).localeCompare(showcaseDate(a)))
        .slice(0, SHOWCASE_CANDIDATES);
      if (recent.length === 0) return [];

      // Every category of the candidates, so the badge reads "Completed" only
      // when the whole tournament is done and the date can fall back to them.
      const { data: cats } = await supabase
        .from("categories")
        .select("tournament_id, status, event_date")
        .in(
          "tournament_id",
          recent.map((t) => t.id),
        );
      const byTournament = new Map<
        string,
        { status: TournamentStatus; event_date: string | null }[]
      >();
      for (const c of (cats ?? []) as {
        tournament_id: string;
        status: TournamentStatus;
        event_date: string | null;
      }[]) {
        const list = byTournament.get(c.tournament_id) ?? [];
        list.push({ status: c.status, event_date: c.event_date });
        byTournament.set(c.tournament_id, list);
      }

      // One head-count per candidate; `participants` rows are the teams.
      const counts = await Promise.all(
        recent.map(async (t) => {
          const { count } = await supabase
            .from("participants")
            .select("id", { count: "exact", head: true })
            .eq("tournament_id", t.id);
          return count ?? 0;
        }),
      );

      return recent
        .map((t, i) => {
          const cats = byTournament.get(t.id) ?? [];
          const dates = cats
            .map((c) => c.event_date)
            .filter((d): d is string => Boolean(d))
            .sort();
          const status = aggregateStatus(cats.map((c) => c.status));
          return {
            id: t.id,
            name: t.name,
            short_code: t.short_code,
            location: t.location,
            banner: t.banner,
            date: t.start_date ?? dates[0] ?? null,
            status:
              status === "completed"
                ? ("completed" as const)
                : ("final_stage" as const),
            teams: counts[i],
            categories: cats.length,
          };
        })
        .filter((t) => t.teams >= SHOWCASE_MIN_TEAMS)
        .slice(0, SHOWCASE_SIZE);
    } catch {
      return [];
    }
  },
);
