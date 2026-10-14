import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTournamentByPublicRef, getPublicCategories } from "@/lib/data";
import { portalMetadata } from "./portal-metadata";
import { PublicTabs } from "@/components/public/public-tabs";
import { LiveRefresh } from "@/components/public/live-refresh";
import { TournamentBanner } from "@/components/public/tournament-banner";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicHeader } from "@/components/public/public-header";

/**
 * Link previews for the portal. Facebook, Messenger and Viber all build their
 * thumbnail from the `og:` tags in the server-rendered HTML, so the tournament
 * banner is handed over as `og:image` — served straight from Supabase storage,
 * which is public. Tournaments with no banner fall back to the generated card
 * at `/{code}/og`.
 *
 * The tabs repeat this call with their own label (see `portal-metadata.ts`),
 * because a page-level `openGraph` replaces the layout's rather than merging.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  return portalMetadata(code);
}

/**
 * The public portal, served from the domain root at `/{short_code}` so the
 * link is short enough to print or say out loud. The long slug still resolves
 * here too (see `getTournamentByPublicRef`).
 */
export default async function PublicTournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const tournament = await getTournamentByPublicRef(code);
  if (!tournament) notFound();

  // Each category carries its own play date; the banner announces them all.
  const categories = await getPublicCategories(tournament.id);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Sticky so the brand stays put while a long registration form scrolls. */}
      <PublicHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-6 sm:px-6 sm:pt-6">
        {/* The banner carries the tournament identity across every tab. */}
        <TournamentBanner tournament={tournament} categories={categories} />
        {/* Tabs stick under the header; the page scrolls beneath them. */}
        <div className="mt-4">
          <PublicTabs code={code} />
          <div className="pt-4 sm:pt-6">{children}</div>
        </div>
      </main>

      <PublicFooter />

      <LiveRefresh tournamentId={tournament.id} />
    </div>
  );
}
