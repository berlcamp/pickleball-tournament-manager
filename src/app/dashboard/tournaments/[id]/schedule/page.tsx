import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { loadSchedule } from "@/lib/tournament-data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { ScheduleGenerator } from "@/components/tournament/schedule-generator";
import { ScheduleTable } from "@/components/tournament/schedule-table";
import { ClearScheduleButton } from "@/components/tournament/clear-schedule-button";
import { ScheduleSummaryButton } from "@/components/tournament/schedule-summary-button";
import { QrShare } from "@/components/qr-share";
import { Lock } from "lucide-react";

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
  // The generator can be pointed at a subset of groups (they may play on
  // different days), so it needs the category's group list.
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name")
    .eq("category_id", active.id)
    .order("position");
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

      {roleAtLeast(ctx.role, "admin") && active.status === "draft" && (
        <ScheduleGenerator
          tournamentId={id}
          categoryId={active.id}
          categoryName={active.name}
          settings={active.settings}
          eventDate={active.event_date}
          groups={groups ?? []}
          draftCategories={ctx.categories
            .filter((c) => c.status === "draft")
            .map((c) => ({ id: c.id, name: c.name }))}
        />
      )}

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

      <ScheduleTable
        rows={rows}
        tournamentId={id}
        canQueue={roleAtLeast(ctx.role, "scorekeeper")}
      />
    </div>
  );
}
