import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTournamentByPublicRef, publicClient } from "@/lib/data";
import { loadSchedule } from "@/lib/tournament-data";
import { ScheduleTable } from "@/components/tournament/schedule-table";
import { CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/public/empty-state";
import { ScheduleSpotlight } from "@/components/public/schedule-spotlight";
import { portalMetadata } from "../portal-metadata";

/** Own title and canonical so this tab is indexed as its own page. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return portalMetadata(code, { path: "schedule", label: "Match schedule" });
}

export const dynamic = "force-dynamic";

export default async function PublicSchedulePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const tournament = await getTournamentByPublicRef(code);
  if (!tournament) notFound();

  // The schedule is public as soon as one exists. Load every category's
  // matches; the table's own filter row handles narrowing by category.
  const db = await publicClient();
  const rows = await loadSchedule(db, tournament.id);

  return (
    <div className="space-y-6">
      {rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title="No matches scheduled yet">
          Match times and courts appear here once the organizer builds the
          schedule. Check back soon!
        </EmptyState>
      ) : (
        <>
          <ScheduleSpotlight rows={rows} />
          <section aria-labelledby="full-schedule" className="space-y-3">
            <h2
              id="full-schedule"
              className="text-2xl font-bold uppercase leading-none"
            >
              Full schedule
            </h2>
            <ScheduleTable rows={rows} />
          </section>
        </>
      )}
    </div>
  );
}
