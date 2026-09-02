import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getTournamentByPublicRef,
  getPublicCategories,
  resolveActiveCategory,
  publicClient,
} from "@/lib/data";
import { loadFinals, loadFinalsPreview } from "@/lib/tournament-data";
import { CategoryFilter } from "@/components/public/category-filter";
import { BracketView } from "@/components/tournament/bracket-view";
import { Podium } from "@/components/tournament/podium";
import { portalMetadata } from "../portal-metadata";

/** Own title and canonical so this tab is indexed as its own page. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return portalMetadata(code, { path: "finals", label: "Finals bracket" });
}

export const dynamic = "force-dynamic";

export default async function PublicFinalsPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { code } = await params;
  const { category } = await searchParams;
  const tournament = await getTournamentByPublicRef(code);
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

  // While the group stage is still running there is no bracket yet — show the
  // draw the groups will feed, with a placeholder in every slot.
  const preview =
    rounds.length === 0 ? await loadFinalsPreview(db, active.id) : [];

  return (
    <div className="space-y-8">
      <CategoryFilter categories={categories} activeId={active.id} />
      <Podium placements={placements} />
      {rounds.length > 0 ? (
        <BracketView
          key={active.id}
          tournamentId={tournament.id}
          rounds={rounds}
          canScore={false}
        />
      ) : preview.length > 0 ? (
        <div className="space-y-4">
          <p className="glass rounded-2xl p-4 text-center text-sm text-muted-foreground">
            Projected bracket — each slot shows the group and finishing position
            that will fill it. It moves with the standings until the group stage
            ends.
          </p>
          <BracketView
            key={active.id}
            tournamentId={tournament.id}
            rounds={preview}
            canScore={false}
          />
        </div>
      ) : (
        <p className="glass rounded-2xl p-10 text-center text-muted-foreground">
          The finals bracket hasn’t been drawn yet. Check back soon!
        </p>
      )}
    </div>
  );
}
