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
import { Info, Layers, Network } from "lucide-react";
import { EmptyState } from "@/components/public/empty-state";
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
      <EmptyState icon={Layers} title="Nothing to show yet">
        The organizer hasn&apos;t set up any categories for this tournament.
      </EmptyState>
    );
  }

  const db = await publicClient();
  const { rounds, placements } = await loadFinals(db, active.id);

  // While the group stage is still running there is no bracket yet — show the
  // draw the groups will feed, with a placeholder in every slot.
  const preview =
    rounds.length === 0 ? await loadFinalsPreview(db, active.id) : [];

  return (
    <div className="space-y-6">
      <CategoryFilter categories={categories} activeId={active.id} />
      <Podium placements={placements} />
      {(rounds.length > 0 || preview.length > 0) && (
        <h2 className="text-2xl font-bold uppercase leading-none">
          {rounds.length > 0 ? "Finals bracket" : "Projected bracket"}
        </h2>
      )}
      {rounds.length > 0 ? (
        <BracketView
          key={active.id}
          tournamentId={tournament.id}
          rounds={rounds}
          canScore={false}
        />
      ) : preview.length > 0 ? (
        <div className="space-y-4">
          <p className="flex items-start gap-2.5 rounded-2xl border border-chart-2/30 bg-chart-2/8 p-4 text-sm text-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-chart-2" aria-hidden />
            <span>
              Each slot shows the group and finishing position that will fill
              it — <span className="font-semibold">A1</span> is Group A&apos;s
              winner. It moves with the standings until the group stage ends.
            </span>
          </p>
          <BracketView
            key={active.id}
            tournamentId={tournament.id}
            rounds={preview}
            canScore={false}
          />
        </div>
      ) : (
        <EmptyState icon={Network} title="Bracket not drawn yet">
          The knockout bracket appears here once the group stage is set. Check
          back soon!
        </EmptyState>
      )}
    </div>
  );
}
