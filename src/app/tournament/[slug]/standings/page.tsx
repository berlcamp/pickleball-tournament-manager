import { notFound } from "next/navigation";
import {
  getTournamentBySlug,
  getPublicCategories,
  resolveActiveCategory,
  publicClient,
} from "@/lib/data";
import { loadGroupStage, loadFinals } from "@/lib/tournament-data";
import { PublicStandings } from "@/components/public/public-standings";
import { CategoryFilter } from "@/components/public/category-filter";
import { Podium } from "@/components/tournament/podium";

export const dynamic = "force-dynamic";

export default async function PublicStandingsPage({
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

  const categories = await getPublicCategories(tournament.id);
  const active = resolveActiveCategory(categories, category);

  if (!active) {
    return (
      <p className="glass rounded-2xl p-10 text-center text-muted-foreground">
        No categories have been set up yet.
      </p>
    );
  }

  const db = await publicClient();
  const [groups, finals] = await Promise.all([
    loadGroupStage(db, active.id),
    loadFinals(db, active.id),
  ]);

  return (
    <div className="space-y-8">
      <CategoryFilter categories={categories} activeId={active.id} />
      <Podium placements={finals.placements} />
      <PublicStandings
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          standings: g.standings,
        }))}
      />
    </div>
  );
}
