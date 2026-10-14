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
import { cn } from "@/lib/utils";
import {
  Users,
  Network,
  CalendarClock,
  ClipboardPen,
  Trophy,
  ArrowRight,
  Check,
  Share2,
} from "lucide-react";

// Display order for the collaboration list: owner first, then admins, etc.
const roleRank = (role: MemberRow["role"]) =>
  ({ owner: 3, admin: 2, scorekeeper: 1, viewer: 0 })[role] ?? 0;

async function count(
  table:
    | "participants"
    | "groups"
    | "group_matches"
    | "match_schedules"
    | "final_matches",
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

  // The viewer is already authorized (getTournamentContext returned a role), so
  // read the full member/invite lists with the service client. The RLS-enforced
  // client only exposes rows for tournaments the viewer belongs to and can hide
  // accepted members from an owner whose membership row predates the creator
  // trigger — the service client guarantees every member/invite is returned.
  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServiceClient()
    : supabase;

  // Everything below is independent of everything else, so it goes out in one
  // round trip rather than a waterfall. Only the profile lookup has to wait,
  // because it needs the member ids.
  const [
    participants,
    groups,
    matchesTotal,
    matchesDone,
    scheduled,
    finals,
    { data: memberDataRaw },
    { data: inviteData },
  ] = await Promise.all([
    count("participants", active.id),
    count("groups", active.id),
    count("group_matches", active.id),
    countCompletedMatches(active.id),
    count("match_schedules", active.id),
    count("final_matches", active.id),
    // `tournament_members.user_id` points at `auth.users`, not
    // `pickleball.profiles`, so PostgREST cannot embed the profile — asking it
    // to would fail the whole query and blank the list. Read the profiles
    // separately and join here.
    admin
      .from("tournament_members")
      .select("id, user_id, role")
      .eq("tournament_id", id),
    // Only pending invites remain here; once an invite is accepted the user
    // shows up in `members` (the accept trigger creates their membership row).
    admin
      .from("tournament_invites")
      .select("id, email, role, status")
      .eq("tournament_id", id)
      .eq("status", "pending"),
  ]);

  const memberData = (memberDataRaw ?? []) as unknown as {
    id: string;
    user_id: string;
    role: MemberRow["role"];
  }[];

  const { data: profileData } = memberData.length
    ? await admin
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in(
          "id",
          memberData.map((m) => m.user_id),
        )
    : { data: [] };

  const profiles = new Map(
    ((profileData ?? []) as unknown as {
      id: string;
      full_name: string | null;
      email: string;
      avatar_url: string | null;
    }[]).map((p) => [p.id, p]),
  );

  const members: MemberRow[] = memberData
    .map((m) => {
      const p = profiles.get(m.user_id);
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

  const invites = (inviteData ?? []) as InviteRow[];

  const progress =
    matchesTotal > 0 ? Math.round((matchesDone / matchesTotal) * 100) : 0;

  const base = `/dashboard/tournaments/${id}`;
  const qs = category ? `?category=${category}` : "";

  // The organiser's path through a category, judged from the counts above. A
  // step counts as done once its output exists, so the first unfinished one is
  // always the honest "what now".
  const steps = [
    {
      title: "Add teams",
      hint:
        participants > 0
          ? `${participants} ${participants === 1 ? "team" : "teams"} so far`
          : "Import approved registrations or type teams in.",
      done: participants >= 2,
      href: "participants",
      icon: Users,
    },
    {
      title: "Make groups",
      hint: groups > 0 ? `${groups} groups drawn` : "Seed the teams, then draw groups.",
      done: groups > 0,
      href: "groups",
      icon: Network,
    },
    {
      title: "Generate the schedule",
      hint:
        scheduled > 0
          ? `${scheduled} matches on court`
          : "Assign courts and start times.",
      done: scheduled > 0,
      href: "schedule",
      icon: CalendarClock,
    },
    {
      title: "Enter scores",
      hint:
        matchesTotal > 0
          ? `${matchesDone} of ${matchesTotal} group matches played`
          : "Scores open once groups are drawn.",
      done: matchesTotal > 0 && matchesDone === matchesTotal,
      href: "group-stage",
      icon: ClipboardPen,
    },
    {
      title: "Run the finals",
      hint:
        finals > 0
          ? "Bracket drawn"
          : "Draw the knockout bracket from the group winners.",
      done: active.status === "completed",
      href: "finals",
      icon: Trophy,
    },
  ];
  const nextIndex = steps.findIndex((s) => !s.done);

  const stats = [
    { label: "Teams", value: participants, icon: Users, href: "participants" },
    { label: "Groups", value: groups, icon: Network, href: "groups" },
    {
      label: "Matches played",
      value: `${matchesDone}/${matchesTotal}`,
      icon: ClipboardPen,
      href: "group-stage",
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="eyebrow">{active.name}</p>
              <h2 className="font-heading text-2xl font-bold">
                {nextIndex === -1 ? "All done" : "What to do next"}
              </h2>
            </div>
            <span className="scoreboard text-lg font-bold text-muted-foreground">
              {nextIndex === -1 ? steps.length : nextIndex}/{steps.length}
            </span>
          </div>
          <ol className="mt-4 space-y-2">
            {steps.map((s, i) => {
              const isNext = i === nextIndex;
              return (
                <li key={s.title}>
                  <Link
                    href={`${base}/${s.href}${qs}`}
                    className={cn(
                      "group flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                      isNext
                        ? "border-primary/40 bg-primary/8 hover:bg-primary/12"
                        : "border-transparent hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "scoreboard grid size-8 shrink-0 place-items-center rounded-full text-base font-bold",
                        s.done
                          ? "bg-primary text-primary-foreground"
                          : isNext
                            ? "bg-ball text-ball-foreground"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {s.done ? <Check className="size-4" /> : i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block font-semibold",
                          s.done && !isNext && "text-muted-foreground",
                        )}
                      >
                        {s.title}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {s.hint}
                      </span>
                    </span>
                    {isNext ? (
                      <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary">
                        <span className="hidden sm:inline">Start</span>
                        <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    ) : (
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {stats.map((s) => (
            <Link
              key={s.label}
              href={`${base}/${s.href}${qs}`}
              className="rounded-2xl border border-border bg-card p-3 shadow-card outline-none transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="eyebrow truncate">{s.label}</span>
                <s.icon className="hidden size-5 text-primary sm:block" />
              </div>
              <div className="scoreboard mt-1 text-3xl font-bold sm:text-4xl">
                {s.value}
              </div>
            </Link>
          ))}
        </div>

        <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-baseline justify-between">
            <h2 className="font-heading text-xl font-bold">
              Group stage progress
            </h2>
            <span className="scoreboard text-xl font-bold text-primary">
              {progress}%
            </span>
          </div>
          <Progress value={progress} />
          <p className="text-sm text-muted-foreground">
            {matchesTotal === 0
              ? "No group matches yet. They appear once groups are drawn."
              : `${matchesTotal - matchesDone} of ${matchesTotal} matches still to play.`}
          </p>
        </section>

        <Collaboration
          tournamentId={id}
          myRole={role}
          members={members}
          invites={invites}
        />
      </div>

      <div className="space-y-6">
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2">
            <Share2 className="size-5 text-primary" />
            <h2 className="font-heading text-xl font-bold">Share with players</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Post these links or show the QR codes so players and spectators
            can follow along on their phones. No login needed.
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
          </div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href={`/${tournament.short_code}`} target="_blank">
              Open the public page <ArrowRight className="size-4" />
            </Link>
          </Button>
        </section>

        {tournament.description && (
          <section className="space-y-2 rounded-2xl border border-border bg-card p-5 shadow-card">
            <h2 className="font-heading text-xl font-bold">About</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {tournament.description}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
