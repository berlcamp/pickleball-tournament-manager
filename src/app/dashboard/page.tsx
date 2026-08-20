import Link from "next/link";
import { getMyTournaments } from "@/lib/data";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TournamentStatusBadge } from "@/components/status-badge";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Plus, Trophy, MapPin, Calendar } from "lucide-react";

/**
 * The dashboard IS the tournament list — there is no side nav to hang an
 * overview off, and every other screen is reached through a tournament.
 */
export default async function DashboardPage() {
  const tournaments = await getMyTournaments();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tournaments"
        description="All tournaments you own or collaborate on."
      >
        <Button asChild>
          <Link href="/dashboard/tournaments/new">
            <Plus className="size-4" /> New Tournament
          </Link>
        </Button>
      </PageHeader>

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/tournaments/${t.id}`}
              className="glass group flex flex-col overflow-hidden rounded-2xl transition-transform hover:-translate-y-0.5"
            >
              <div
                className="h-24 bg-gradient-to-br from-primary/30 to-chart-2/20"
                style={
                  t.banner
                    ? {
                        backgroundImage: `url(${t.banner})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : undefined
                }
              />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold leading-tight">{t.name}</h3>
                  <TournamentStatusBadge status={t.status} />
                </div>
                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" /> {formatDate(t.start_date)}
                  </div>
                  {t.location && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> {t.location}
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Badge variant="secondary">{ROLE_LABELS[t.role]}</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
