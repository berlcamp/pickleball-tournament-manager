import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { loadSchedule } from "@/lib/tournament-data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { ScheduleGenerator } from "@/components/tournament/schedule-generator";
import { ScheduleTable } from "@/components/tournament/schedule-table";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="Court assignments and match times for this category."
      >
        <QrShare
          path={`/tournament/${ctx.tournament.slug}/schedule`}
          label="Share schedule"
        />
      </PageHeader>

      {roleAtLeast(ctx.role, "admin") && active.status === "draft" && (
        <ScheduleGenerator
          tournamentId={id}
          categoryId={active.id}
          categoryName={active.name}
          settings={active.settings}
        />
      )}

      {roleAtLeast(ctx.role, "admin") && active.status !== "draft" && (
        <div className="glass flex items-center gap-2 rounded-2xl p-4 text-sm text-muted-foreground">
          <Lock className="size-4" />
          Group stage has started — the schedule is locked.
        </div>
      )}

      <ScheduleTable rows={rows} />
    </div>
  );
}
