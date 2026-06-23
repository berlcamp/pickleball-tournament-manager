import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext } from "@/lib/data";
import { roleAtLeast } from "@/lib/constants";
import {
  Collaboration,
  type MemberRow,
  type InviteRow,
} from "@/components/tournament/collaboration";
import { DangerZone } from "@/components/tournament/danger-zone";
import { QrShare } from "@/components/qr-share";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/progress-bar";
import {
  Users,
  Network,
  CalendarClock,
  ArrowRight,
  Pencil,
} from "lucide-react";

async function count(
  table: "participants" | "groups" | "group_matches",
  tournamentId: string,
) {
  const supabase = await createClient();
  const { count } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId);
  return count ?? 0;
}

async function countCompletedMatches(tournamentId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("group_matches")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("status", "completed");
  return count ?? 0;
}

export default async function TournamentOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getTournamentContext(id);
  if (!ctx) notFound();
  const { tournament, role } = ctx;
  const supabase = await createClient();

  const [participants, groups, matchesTotal, matchesDone] = await Promise.all([
    count("participants", id),
    count("groups", id),
    count("group_matches", id),
    countCompletedMatches(id),
  ]);

  const { data: memberDataRaw } = await supabase
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

  const members: MemberRow[] = memberData.map((m) => {
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
  });

  const { data: inviteData } = await supabase
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

  const canEdit = roleAtLeast(role, "admin");

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

        {tournament.description && (
          <div className="glass space-y-2 rounded-2xl p-5">
            <h3 className="font-semibold">About</h3>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {tournament.description}
            </p>
          </div>
        )}

        <div className="glass space-y-3 rounded-2xl p-5">
          <h3 className="font-semibold">Public sharing</h3>
          <p className="text-sm text-muted-foreground">
            Share these links or QR codes with players and spectators.
          </p>
          <div className="flex flex-wrap gap-2">
            <QrShare
              path={`/tournament/${tournament.slug}/standings`}
              label="Standings"
            />
            <QrShare
              path={`/tournament/${tournament.slug}/schedule`}
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
        <Collaboration
          tournamentId={id}
          myRole={role}
          members={members}
          invites={invites}
        />

        {canEdit && (
          <div className="glass space-y-3 rounded-2xl p-5">
            <h3 className="font-semibold">Settings</h3>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/dashboard/tournaments/${id}/settings`}>
                <Pencil className="size-4" /> Edit details
              </Link>
            </Button>
          </div>
        )}

        {role === "owner" && <DangerZone tournamentId={id} />}
      </div>
    </div>
  );
}
