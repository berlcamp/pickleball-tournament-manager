import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTournamentByPublicRef, getPublicCategories } from "@/lib/data";
import { PublicTabs } from "@/components/public/public-tabs";
import { LiveRefresh } from "@/components/public/live-refresh";
import { TournamentBanner } from "@/components/public/tournament-banner";
import { PublicFooter } from "@/components/public/public-footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Trophy } from "lucide-react";
import { formatEventDates } from "@/lib/format";
import { requestOrigin } from "@/lib/site-url";

/** Trim to a whole word so a preview never ends mid-syllable. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Link previews for the portal. Facebook, Messenger and Viber all build their
 * thumbnail from the `og:` tags in the server-rendered HTML, so the tournament
 * banner is handed over as `og:image` — served straight from Supabase storage,
 * which is public. Tournaments with no banner fall back to the generated card
 * at `/{code}/og`.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const tournament = await getTournamentByPublicRef(code);
  if (!tournament) return {};

  const categories = await getPublicCategories(tournament.id);
  const when = formatEventDates(
    tournament.start_date,
    categories.map((c) => c.event_date),
  );
  const where = [when, tournament.location].filter(Boolean).join(" · ");
  // Chat previews show two or three lines, so lead with when and where and
  // flatten the organiser's blurb (newlines and all) into what still fits.
  const blurb = tournament.description?.replace(/\s+/g, " ").trim();
  const description = clamp(
    blurb
      ? `${where} — ${blurb}`
      : `${where} — live standings, schedule and registration on PicklePro.`,
    200,
  );
  const url = `/${tournament.short_code ?? code}`;

  // The uploaded banner is used as-is: it is the poster the organiser designed,
  // so nothing is drawn over it. Only the no-banner case is generated, and that
  // one has known dimensions worth declaring.
  const image = tournament.banner
    ? { url: tournament.banner, alt: tournament.name }
    : { url: `${url}/og`, width: 1200, height: 630, alt: tournament.name };

  return {
    // Pin the base to the host the link was actually shared from, so a preview
    // built on the production domain, a Vercel preview or localhost all point
    // the crawler back at themselves.
    metadataBase: new URL(await requestOrigin()),
    title: tournament.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: tournament.name,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: tournament.name,
      description,
      images: [image.url],
    },
  };
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
    <div className="min-h-screen">
      {/* Sticky so the brand stays put while a long registration form scrolls. */}
      <header className="glass sticky top-0 z-40 border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold"
          >
            <Trophy className="size-4 shrink-0 text-primary" />
            <span className="text-gradient">PicklePro</span>
            <span className="font-normal text-muted-foreground">
              by Sortbrite
            </span>
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {/* The banner carries the tournament identity across every tab. */}
        <TournamentBanner tournament={tournament} categories={categories} />
        <div>
          <PublicTabs code={code} />
          <div className="pt-6">{children}</div>
        </div>
      </div>

      <PublicFooter />

      <LiveRefresh tournamentId={tournament.id} />
    </div>
  );
}
