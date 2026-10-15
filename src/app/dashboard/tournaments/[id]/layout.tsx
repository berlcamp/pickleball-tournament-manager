import { notFound } from "next/navigation";
import Link from "next/link";
import { getTournamentContext } from "@/lib/data";
import { WorkspaceNav } from "@/components/tournament/workspace-nav";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, roleAtLeast } from "@/lib/constants";
import { ExternalLink, MapPin, Calendar } from "lucide-react";
import { HeaderNavButton } from "@/components/tournament/header-nav-button";
import { HEADER_BUTTON } from "@/components/tournament/header-button";
import { formatEventDates } from "@/lib/format";
import { CourtBackdrop } from "@/components/court-backdrop";

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getTournamentContext(id);
  if (!ctx) notFound();
  const { tournament: t, role, categories } = ctx;
  const canManage = roleAtLeast(role, "admin");

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="relative isolate bg-court text-court-foreground">
          <CourtBackdrop />
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:px-9 sm:py-8">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Link
                  href="/dashboard"
                  className="rounded text-sm text-court-foreground/75 outline-none hover:text-court-foreground focus-visible:ring-2 focus-visible:ring-ball"
                >
                  ← All tournaments
                </Link>
                <Badge className="border-0 bg-ball text-ball-foreground">
                  {ROLE_LABELS[role]}
                </Badge>
              </div>
              <h1 className="text-balance text-3xl font-bold uppercase leading-[0.95] sm:text-5xl">
                {t.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-court-foreground/80">
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-4" />{" "}
                  {formatEventDates(categories.map((c) => c.event_date))}
                </span>
                {t.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" /> {t.location}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <HeaderNavButton
                id={id}
                seg="schedule"
                label="Schedules"
                icon="schedule"
              />
              {canManage && (
                <HeaderNavButton
                  id={id}
                  seg="settings"
                  label="Settings"
                  icon="settings"
                />
              )}
              <Button
                asChild
                variant="outline"
                size="sm"
                className={HEADER_BUTTON}
              >
                <Link href={`/${t.short_code}`} target="_blank">
                  <ExternalLink className="size-4" /> Public page
                </Link>
              </Button>
            </div>
          </div>
        </div>
        <WorkspaceNav id={id} categories={categories} />
      </section>

      <div>{children}</div>
    </div>
  );
}
