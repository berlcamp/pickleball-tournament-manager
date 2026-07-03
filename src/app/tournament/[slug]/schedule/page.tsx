import { notFound } from "next/navigation";
import {
  getTournamentBySlug,
  getPublicCategories,
  publicClient,
} from "@/lib/data";
import { loadSchedule } from "@/lib/tournament-data";
import { ScheduleTable } from "@/components/tournament/schedule-table";
import { CategoryFilter } from "@/components/public/category-filter";

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

  if (!tournament.show_public_schedule) {
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
