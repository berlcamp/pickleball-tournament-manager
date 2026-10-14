import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTournamentByPublicRef, publicClient } from "@/lib/data";
import { loadSchedule } from "@/lib/tournament-data";
import { getTournamentRole } from "@/lib/auth";
import { roleAtLeast } from "@/lib/constants";
import { ScheduleTable } from "@/components/tournament/schedule-table";
import { CalendarClock, EyeOff } from "lucide-react";
import { EmptyState } from "@/components/public/empty-state";
import { ScheduleSpotlight } from "@/components/public/schedule-spotlight";
import { portalMetadata } from "../portal-metadata";

/**
 * Own title and canonical so this tab is indexed as its own page — unless the
 * organiser has hidden the schedule, in which case the only thing a crawler
 * would find is the "currently unavailable" notice.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const tournament = await getTournamentByPublicRef(code);
  const meta = await portalMetadata(code, {
    path: "schedule",
    label: "Match schedule",
  });
  if (tournament && !tournament.show_public_schedule) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
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

  // When the schedule is hidden from the public, signed-in staff (scorekeeper,
  // admin, or owner) can still preview it in their own session.
  const isStaff =
    !tournament.show_public_schedule &&
    roleAtLeast(await getTournamentRole(tournament.id), "scorekeeper");

  if (!tournament.show_public_schedule && !isStaff) {
    return (
      <EmptyState icon={EyeOff} title="Schedule hidden for now">
        The organizer will publish the match schedule here. Check back closer to
        game day.
      </EmptyState>
    );
  }

  // Load every category's matches; the schedule table's own filter row handles
  // narrowing by category, so no separate dropdown is needed here.
  const db = await publicClient();
  const rows = await loadSchedule(db, tournament.id);

  return (
    <div className="space-y-6">
      {isStaff && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
          <EyeOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          This schedule is hidden from the public. You can see it because
          you&apos;re signed in as tournament staff.
        </div>
      )}
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
