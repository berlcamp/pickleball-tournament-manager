import Link from "next/link";
import { getMyTournaments } from "@/lib/data";
import { requireUser } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/super-admin";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { TournamentStatusBadge } from "@/components/status-badge";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { ArrowRight, Plus, Trophy, MapPin, Calendar, Ticket } from "lucide-react";

/**
 * The dashboard IS the tournament list — there is no side nav to hang an
 * overview off, and every other screen is reached through a tournament.
 */
export default async function DashboardPage() {
  const [tournaments, user] = await Promise.all([
    getMyTournaments(),
    requireUser(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tournaments"
        description="Every tournament you run or help with. Pick one to manage teams, scores and schedules."
      >
        {isSuperAdmin(user.email) && (
          <Button asChild variant="outline">
            <Link href="/dashboard/raffle">
              <Ticket className="size-4" /> Raffle
            </Link>
          </Button>
        )}
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
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link
                href={`/dashboard/tournaments/${t.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card outline-none transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div
                  className="bg-court-lines relative h-28 bg-court"
                  style={
                    t.banner
                      ? {
                          backgroundImage: `url(${t.banner})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  <div className="absolute top-3 left-3">
                    <TournamentStatusBadge status={t.status} />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <h2 className="line-clamp-2 text-2xl font-bold leading-[1.05]">
                    {t.name}
                  </h2>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4 shrink-0 text-primary" />
                      {formatDate(t.start_date)}
                    </div>
                    {t.location && (
                      <div className="flex items-center gap-2">
                        <MapPin className="size-4 shrink-0 text-primary" />
                        <span className="truncate">{t.location}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-sm">
                    <span className="text-muted-foreground">
                      {t.categoryCount}{" "}
                      {t.categoryCount === 1 ? "category" : "categories"}
                      {" · "}
                      {ROLE_LABELS[t.role]}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-primary">
                      Open
                      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/dashboard/tournaments/new"
              className="flex h-full min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground outline-none transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
                <Plus className="size-6" />
              </span>
              <span className="font-heading text-xl font-bold">
                New tournament
              </span>
            </Link>
          </li>
        </ul>
      )}
    </div>
  );
}
