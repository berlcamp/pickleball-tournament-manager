import { notFound } from "next/navigation";
import {
  getTournamentBySlug,
  getPublicCategories,
  publicClient,
} from "@/lib/data";
import { loadSchedule } from "@/lib/tournament-data";
import { getTournamentRole } from "@/lib/auth";
import { roleAtLeast } from "@/lib/constants";
import { ScheduleTable } from "@/components/tournament/schedule-table";
import { CategoryFilter } from "@/components/public/category-filter";
import { EyeOff } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { slug } = await params;
  const { category } = await searchParams;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  // When the schedule is hidden from the public, signed-in staff (scorekeeper,
  // admin, or owner) can still preview it in their own session.
  const isStaff =
    !tournament.show_public_schedule &&
    roleAtLeast(await getTournamentRole(tournament.id), "scorekeeper");

  if (!tournament.show_public_schedule && !isStaff) {
    return (
      <p className="glass rounded-2xl p-10 text-center text-muted-foreground">
        The match schedule is currently unavailable.
      </p>
    );
  }

  const categories = await getPublicCategories(tournament.id);
  // Default to the combined "All categories" view.
  const active =
    category && category !== "all"
      ? categories.find((c) => c.id === category)
      : undefined;
  const activeId = active ? active.id : "all";

  const db = await publicClient();
  const rows = await loadSchedule(db, tournament.id, active?.id);

  return (
    <div className="space-y-6">
      {isStaff && (
        <div className="glass flex items-center gap-2 rounded-2xl p-4 text-sm text-muted-foreground">
          <EyeOff className="size-4 shrink-0" />
          This schedule is hidden from the public. You can see it because
          you&apos;re signed in as tournament staff.
        </div>
      )}
      <CategoryFilter categories={categories} activeId={activeId} allowAll />
      {rows.length === 0 ? (
        <p className="glass rounded-2xl p-10 text-center text-muted-foreground">
          The schedule hasn’t been published yet. Check back soon!
        </p>
      ) : (
        <ScheduleTable rows={rows} />
      )}
    </div>
  );
}
