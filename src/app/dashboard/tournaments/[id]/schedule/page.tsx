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
        description="Court assignments and match times for this category."
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
        <div className="glass flex items-center gap-2 rounded-2xl p-4 text-sm text-muted-foreground">
          <Lock className="size-4" />
          Group stage has started — match times and courts are locked, but you
          can still queue matches below.
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
              ? "Use the Schedule Generator button at the top of the page to lay out match times and courts for this category."
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
