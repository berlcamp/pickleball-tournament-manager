import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getTournamentByPublicRef,
  getPublicCategories,
  resolveActiveCategory,
  publicClient,
} from "@/lib/data";
import {
  loadGroupStage,
  loadFinals,
  loadSeedingSnapshot,
} from "@/lib/tournament-data";
import { PublicStandings } from "@/components/public/public-standings";
import { CategoryFilter } from "@/components/public/category-filter";
import { Podium } from "@/components/tournament/podium";
import { BracketView } from "@/components/tournament/bracket-view";
import { FinalsSeedingDialog } from "@/components/tournament/finals-seeding-dialog";
import { Layers } from "lucide-react";
import { EmptyState } from "@/components/public/empty-state";
import { portalMetadata } from "../portal-metadata";

/** Own title and canonical so this tab is indexed as its own page. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return portalMetadata(code, { path: "standings", label: "Standings & finals" });
}

export const dynamic = "force-dynamic";

export default async function PublicStandingsPage({
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
      <EmptyState icon={Layers} title="Nothing to show yet">
        The organizer hasn&apos;t set up any categories for this tournament.
      </EmptyState>
    );
  }

  const db = await publicClient();
  const [groups, finals, seeding] = await Promise.all([
    loadGroupStage(db, active.id),
    loadFinals(db, active.id),
    loadSeedingSnapshot(db, active.id),
  ]);

  return (
    <div className="space-y-6">
      <CategoryFilter categories={categories} activeId={active.id} />
      <Podium placements={finals.placements} />
      {/* Once the knockout is drawn it is what everyone is following, so it
          leads; the group tables it came from follow below. */}
      {finals.rounds.length > 0 && (
        <section aria-labelledby="finals-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2
              id="finals-heading"
              className="text-2xl font-bold uppercase leading-none"
            >
              Finals
            </h2>
            {seeding && <FinalsSeedingDialog snapshot={seeding} locked />}
          </div>
          <BracketView
            key={active.id}
            tournamentId={tournament.id}
            rounds={finals.rounds}
            canScore={false}
          />
        </section>
      )}
      <PublicStandings
        key={active.id}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          standings: g.standings,
        }))}
        // With the bracket drawn the seeding button sits by "Finals" instead.
        action={
          seeding &&
          finals.rounds.length === 0 && (
            <FinalsSeedingDialog snapshot={seeding} locked={false} />
          )
        }
      />
    </div>
  );
}
