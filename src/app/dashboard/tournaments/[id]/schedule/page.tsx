import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { loadSchedule } from "@/lib/tournament-data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/page-header";
import { ScheduleTable } from "@/components/tournament/schedule-table";
import { ClearScheduleButton } from "@/components/tournament/clear-schedule-button";
import { ScheduleSummaryButton } from "@/components/tournament/schedule-summary-button";
import { QrShare } from "@/components/qr-share";
import { CalendarClock, Lock } from "lucide-react";

export default async function SchedulePage({
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
  const active = resolveActiveCategory(ctx.categories, category);
  if (!active) notFound();

  const supabase = await createClient();
  const rows = await loadSchedule(supabase, id, active.id);
  // The PDF summary spans every category, not just the active one.
  const allRows = await loadSchedule(supabase, id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="Who plays where and when. Tap Queue to call a match to its court next."
      >
        <ScheduleSummaryButton
          rows={allRows}
          tournamentName={ctx.tournament.name}
        />
        <QrShare
          path={`/${ctx.tournament.short_code}/schedule`}
          label="Share schedule"
        />
      </PageHeader>

      {roleAtLeast(ctx.role, "admin") && active.status !== "draft" && (
        <div className="glass flex items-start gap-3 rounded-2xl p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="size-4" />
          </span>
          <div className="text-sm">
            <p className="font-semibold">Times and courts are locked</p>
            <p className="text-muted-foreground">
              {active.name} has started, and players are going by this
              schedule. You can still queue matches below to call teams to
              their court.
            </p>
          </div>
        </div>
      )}

      {roleAtLeast(ctx.role, "admin") &&
        active.status === "draft" &&
        rows.length > 0 && (
          <div className="flex justify-end">
            <ClearScheduleButton
              tournamentId={id}
              categoryId={active.id}
              categoryName={active.name}
            />
          </div>
        )}

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No schedule yet"
          description={
            roleAtLeast(ctx.role, "admin")
              ? "Press Schedule Generator in the tournament header to lay out match times and courts. Draw the groups first — the schedule is built from their matches."
              : "Match times and courts haven't been published for this category yet."
          }
        />
      ) : (
        <ScheduleTable
          rows={rows}
          tournamentId={id}
          canQueue={roleAtLeast(ctx.role, "scorekeeper")}
        />
      )}
    </div>
  );
}
