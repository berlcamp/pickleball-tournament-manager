import { notFound } from "next/navigation";
import {
  getTournamentBySlug,
  getPublicCategories,
  resolveActiveCategory,
  publicClient,
} from "@/lib/data";
import { loadFinals } from "@/lib/tournament-data";
import { CategoryFilter } from "@/components/public/category-filter";
import { BracketView } from "@/components/tournament/bracket-view";
import { Podium } from "@/components/tournament/podium";

export const dynamic = "force-dynamic";

export default async function PublicFinalsPage({
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
  const { rounds, placements } = await loadFinals(db, active.id);

  return (
    <div className="space-y-8">
      <CategoryFilter categories={categories} activeId={active.id} />
      <Podium placements={placements} />
      {rounds.length === 0 ? (
        <p className="glass rounded-2xl p-10 text-center text-muted-foreground">
          The finals bracket hasn’t been drawn yet. Check back soon!
        </p>
      ) : (
        <BracketView
          key={active.id}
          tournamentId={tournament.id}
          rounds={rounds}
          canScore={false}
        />
      )}
    </div>
  );
}
