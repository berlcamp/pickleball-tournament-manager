import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { loadSchedule } from "@/lib/tournament-data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { ScheduleGenerator } from "@/components/tournament/schedule-generator";
import { ScheduleTable } from "@/components/tournament/schedule-table";
import { QrShare } from "@/components/qr-share";

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

      {roleAtLeast(ctx.role, "admin") && (
        <ScheduleGenerator
          tournamentId={id}
          categoryId={active.id}
          categoryName={active.name}
          settings={active.settings}
        />
      )}

      <ScheduleTable rows={rows} />
    </div>
  );
}
