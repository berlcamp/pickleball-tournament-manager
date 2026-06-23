import Link from "next/link";
import { getMyTournaments } from "@/lib/data";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { TournamentStatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { Plus, Trophy, Activity, CheckCircle2, Calendar } from "lucide-react";

export default async function DashboardPage() {
  const tournaments = await getMyTournaments();
  const active = tournaments.filter(
    (t) => t.status === "group_stage" || t.status === "final_stage",
  ).length;
  const completed = tournaments.filter((t) => t.status === "completed").length;

  const stats = [
    { label: "Tournaments", value: tournaments.length, icon: Trophy },
    { label: "Active", value: active, icon: Activity },
    { label: "Completed", value: completed, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Overview"
        description="Your pickleball tournaments at a glance."
      >
        <Button asChild>
          <Link href="/dashboard/tournaments/new">
            <Plus className="size-4" /> New Tournament
          </Link>
        </Button>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <s.icon className="size-5 text-primary" />
            </div>
            <div className="mt-2 text-3xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent tournaments</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/tournaments">View all</Link>
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No tournaments yet"
            description="Create your first tournament to start adding teams and generating groups."
          >
            <Button asChild>
              <Link href="/dashboard/tournaments/new">
                <Plus className="size-4" /> Create tournament
              </Link>
            </Button>
          </EmptyState>
        ) : (
          <div className="grid gap-3">
            {tournaments.slice(0, 5).map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/tournaments/${t.id}`}
                className="glass flex items-center justify-between rounded-2xl p-4 transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{t.name}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="size-3.5" />
                    {formatDate(t.start_date)}
                    {t.location && <span>· {t.location}</span>}
                  </div>
                </div>
                <TournamentStatusBadge status={t.status} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
