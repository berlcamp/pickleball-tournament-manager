import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import {
  Collaboration,
  type MemberRow,
  type InviteRow,
} from "@/components/tournament/collaboration";
import { QrShare } from "@/components/qr-share";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/progress-bar";
import {
  Users,
  Network,
  CalendarClock,
  ArrowRight,
} from "lucide-react";

// Display order for the collaboration list: owner first, then admins, etc.
const roleRank = (role: MemberRow["role"]) =>
  ({ owner: 3, admin: 2, scorekeeper: 1, viewer: 0 })[role] ?? 0;

async function count(
  table: "participants" | "groups" | "group_matches",
  categoryId: string,
) {
  const supabase = await createClient();
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);
  return count ?? 0;
}

async function countCompletedMatches(categoryId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("group_matches")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("status", "completed");
  return count ?? 0;
}

export default async function TournamentOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { id } = await params;
  const { category } = await searchParams;
  const ctx = await getTournamentContext(id);
  if (!ctx) notFound();
  const { tournament, role } = ctx;
  const active = resolveActiveCategory(ctx.categories, category);
  if (!active) notFound();
  const supabase = await createClient();

  const [participants, groups, matchesTotal, matchesDone] = await Promise.all([
    count("participants", active.id),
    count("groups", active.id),
    count("group_matches", active.id),
    countCompletedMatches(active.id),
  ]);

  // The viewer is already authorized (getTournamentContext returned a role), so
  // read the full member/invite lists with the service client. The RLS-enforced
  // client only exposes rows for tournaments the viewer belongs to and can hide
  // accepted members from an owner whose membership row predates the creator
  // trigger — the service client guarantees every member/invite is returned.
  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient()
    : supabase;

  const { data: memberDataRaw } = await admin
    .from("tournament_members")
    .select("id, user_id, role, profiles(full_name, email, avatar_url)")
    .eq("tournament_id", id);

  const memberData = (memberDataRaw ?? []) as unknown as {
    id: string;
    user_id: string;
    role: MemberRow["role"];
    profiles: {
      full_name: string | null;
      email: string;
      avatar_url: string | null;
    } | null;
  }[];

  const members: MemberRow[] = memberData
    .map((m) => {
      const p = m.profiles as unknown as
        | { full_name: string | null; email: string; avatar_url: string | null }
        | null;
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        name: p?.full_name ?? "",
        email: p?.email ?? "",
        avatar_url: p?.avatar_url ?? null,
      };
    })
    // Owner first, then admins, scorekeepers, viewers.
    .sort((a, b) => roleRank(b.role) - roleRank(a.role));

  // Only pending invites remain here; once an invite is accepted the user shows
  // up in `members` above (the accept trigger creates their membership row).
  const { data: inviteData } = await admin
    .from("tournament_invites")
    .select("id, email, role, status")
    .eq("tournament_id", id)
    .eq("status", "pending");
  const invites = (inviteData ?? []) as InviteRow[];

  const progress =
    matchesTotal > 0 ? Math.round((matchesDone / matchesTotal) * 100) : 0;

  const stats = [
    { label: "Teams", value: participants, icon: Users, href: "participants" },
    { label: "Groups", value: groups, icon: Network, href: "groups" },
    {
      label: "Matches",
      value: `${matchesDone}/${matchesTotal}`,
      icon: CalendarClock,
      href: "group-stage",
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={`/dashboard/tournaments/${id}/${s.href}`}
              className="glass rounded-2xl p-5 transition-colors hover:bg-accent/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{s.label}</span>
                <s.icon className="size-5 text-primary" />
              </div>
              <div className="mt-2 text-2xl font-bold">{s.value}</div>
            </Link>
          ))}
        </div>

        <div className="glass space-y-3 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Group stage progress</h3>
            <span className="text-sm text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} />
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/tournaments/${id}/group-stage`}>
                Enter scores <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={`/dashboard/tournaments/${id}/finals`}>
                Finals <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>

        <Collaboration
          tournamentId={id}
          myRole={role}
          members={members}
          invites={invites}
        />

        <div className="glass space-y-3 rounded-2xl p-5">
          <h3 className="font-semibold">Public sharing</h3>
          <p className="text-sm text-muted-foreground">
            Share these links or QR codes with players and spectators.
          </p>
          <div className="flex flex-wrap gap-2">
            <QrShare
              path={`/${tournament.short_code}/standings`}
              label="Standings"
            />
            <QrShare
              path={`/${tournament.short_code}/schedule`}
              label="Schedule"
            />
            <Button asChild variant="outline" size="sm">
              <Link href="/monitor" target="_blank">
                Live monitor
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {tournament.description && (
          <div className="glass space-y-2 rounded-2xl p-5">
            <h3 className="font-semibold">About</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {tournament.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
