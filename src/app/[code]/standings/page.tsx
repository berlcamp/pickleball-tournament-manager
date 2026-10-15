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
  return portalMetadata(code, { path: "standings", label: "Standings" });
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
      <PublicStandings
        key={active.id}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          standings: g.standings,
        }))}
        action={
          seeding && (
            <FinalsSeedingDialog
              snapshot={seeding}
              locked={finals.rounds.length > 0}
            />
          )
        }
      />
    </div>
  );
}
