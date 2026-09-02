import type { Metadata } from "next";
import { getTournamentByPublicRef, getPublicCategories } from "@/lib/data";
import { formatEventDates } from "@/lib/format";
import { requestOrigin } from "@/lib/site-url";
import { SITE_NAME } from "@/lib/seo";

/** Trim to a whole word so a preview never ends mid-syllable. */
function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** One portal tab: the path segment under `/{code}` and its human label. */
export type PortalTab = { path: string; label: string };

/**
 * Metadata for any page of the public portal.
 *
 * Every tab builds its whole `openGraph` object here rather than inheriting
 * the layout's: Next.js *replaces* `openGraph` when a page declares it instead
 * of merging, so a tab that set only a title would silently drop the banner
 * from its link preview.
 *
 * Passing a tab also gives that tab its own title and canonical. Without them
 * every tab would claim to be the index page and search engines would fold
 * them into one result.
 */
export async function portalMetadata(
  code: string,
  tab?: PortalTab,
): Promise<Metadata> {
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
    tab
      ? `${tab.label} for ${tournament.name}. ${where} — live on PicklePro.`
      : blurb
        ? `${where} — ${blurb}`
        : `${where} — live standings, schedule and registration on PicklePro.`,
    200,
  );

  const base = `/${tournament.short_code ?? code}`;
  const url = tab ? `${base}/${tab.path}` : base;
  const title = tab ? `${tab.label} · ${tournament.name}` : tournament.name;

  // The uploaded banner is used as-is: it is the poster the organiser designed,
  // so nothing is drawn over it. Only the no-banner case is generated, and that
  // one has known dimensions worth declaring.
  const image = tournament.banner
    ? { url: tournament.banner, alt: tournament.name }
    : { url: `${base}/og`, width: 1200, height: 630, alt: tournament.name };

  return {
    // Pin the base to the host the link was actually shared from, so a preview
    // built on the production domain, a Vercel preview or localhost all point
    // the crawler back at themselves.
    metadataBase: new URL(await requestOrigin()),
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url,
      title,
      description,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}
