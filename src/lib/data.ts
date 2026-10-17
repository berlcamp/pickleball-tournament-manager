import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { formatEventDates } from "@/lib/format";
import type { Category, Role, Tournament, TournamentStatus } from "@/types";

export interface MyTournament extends Tournament {
  role: Role;
  /** Aggregate status derived from the tournament's categories. */
  status: TournamentStatus;
  categoryCount: number;
  /** The span the categories' play dates cover, e.g. "Oct 4 – Oct 5, 2026". */
  dates: string;
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
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();

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
  const datesByTournament = new Map<string, (string | null)[]>();
  if (ids.length) {
    const { data: cats } = await supabase
      .from("categories")
      .select("tournament_id, status, event_date")
      .in("tournament_id", ids);
    for (const c of cats ?? []) {
      if (!statusByTournament.has(c.tournament_id))
        statusByTournament.set(c.tournament_id, []);
      statusByTournament.get(c.tournament_id)!.push(c.status as TournamentStatus);
      if (!datesByTournament.has(c.tournament_id))
        datesByTournament.set(c.tournament_id, []);
      datesByTournament.get(c.tournament_id)!.push(c.event_date);
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
        dates: formatEventDates(datesByTournament.get(tournament.id)),
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
 * a member.
 *
 * The super admin is the one exception: on a tournament they don't belong to
 * they get in as a `viewer`, flagged `superAdminView`. That only unlocks
 * reading — every mutation still goes through `assertRole`, which checks the
 * membership row and so turns them away. The tournament and its categories
 * are publicly readable, so the RLS-bound reads below still return them.
 *
 * Memoized per request (the workspace layout and its page both ask), and the
 * three reads go out together: RLS already hides a tournament from a
 * non-member, so nothing is gained by waiting on the membership row first. */
export const getTournamentContext = cache(async function (id: string): Promise<{
  tournament: Tournament;
  role: Role;
  categories: Category[];
  /** A super admin looking in on a tournament they aren't a member of. */
  superAdminView: boolean;
} | null> {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: member }, { data: tournament }, { data: categories }] =
    await Promise.all([
      supabase
        .from("tournament_members")
        .select("role")
        .eq("tournament_id", id)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("tournaments").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("categories")
        .select("*")
        .eq("tournament_id", id)
        .order("position"),
    ]);
  if (!tournament) return null;
  const superAdminView = !member && isSuperAdmin(user.email);
  if (!member && !superAdminView) return null;

  return {
    tournament: tournament as Tournament,
    role: superAdminView ? "viewer" : (member!.role as Role),
    categories: (categories ?? []) as Category[],
    superAdminView,
  };
});

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

/** A tournament the super admin has put on the marketing page. */
export interface ShowcaseTournament {
  id: string;
  name: string;
  short_code: string;
  /** Rolled up from its categories, same as the dashboard. */
  status: TournamentStatus;
}

/** How many featured tournaments the homepage marquee shows. */
const SHOWCASE_SIZE = 5;

/**
 * The tournaments flagged `featured` by the super admin on /dashboard/admin,
 * newest first, for the marquee on the marketing page.
 *
 * Which tournaments appear is an editorial decision, not a derived one — the
 * flag is the only filter. Public data only: it runs on the public client so a
 * logged-out visitor sees the same list.
 *
 * Returns an empty list on any failure, including before migration 0015 adds
 * the `featured` column: the marquee is decoration, and the home page must
 * never 500 because of it.
 */
export const loadShowcaseTournaments = cache(
  async function (): Promise<ShowcaseTournament[]> {
    try {
      const supabase = await publicClient();

      const { data: rows, error } = await supabase
        .from("tournaments")
        .select("id, name, short_code")
        .eq("featured", true)
        .order("created_at", { ascending: false })
        .limit(SHOWCASE_SIZE);
      if (error) return [];

      const featured = (rows ?? []) as {
        id: string;
        name: string;
        short_code: string;
      }[];
      if (featured.length === 0) return [];

      // The card shows the rolled-up stage, so the categories are all we need.
      const { data: cats } = await supabase
        .from("categories")
        .select("tournament_id, status")
        .in(
          "tournament_id",
          featured.map((t) => t.id),
        );

      const statuses = new Map<string, TournamentStatus[]>();
      for (const c of (cats ?? []) as {
        tournament_id: string;
        status: TournamentStatus;
      }[]) {
        const list = statuses.get(c.tournament_id) ?? [];
        list.push(c.status);
        statuses.set(c.tournament_id, list);
      }

      return featured.map((t) => ({
        id: t.id,
        name: t.name,
        short_code: t.short_code,
        status: aggregateStatus(statuses.get(t.id) ?? []),
      }));
    } catch {
      return [];
    }
  },
);
