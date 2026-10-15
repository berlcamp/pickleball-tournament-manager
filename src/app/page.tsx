import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { getUser } from "@/lib/auth";
import { loadShowcaseTournaments } from "@/lib/data";
import { TournamentMarquee } from "@/components/marketing/tournament-marquee";
import { requestOrigin } from "@/lib/site-url";
import { SITE_NAME, SITE_TITLE, SITE_DESCRIPTION } from "@/lib/seo";
import { BrandMark } from "@/components/brand-mark";
import { HowItWorks } from "@/components/marketing/how-it-works";
import {
  ArrowRight,
  CalendarClock,
  Users,
  BarChart3,
  QrCode,
  CreditCard,
  Shuffle,
  Network,
  Sparkles,
} from "lucide-react";

/**
 * The thumbnail chat apps show when someone shares the site.
 *
 * Deriving the base from the request keeps every absolute `og:` URL pointing
 * at the host the link was copied from — production, a Vercel preview or
 * localhost alike. The image is `opengraph-image.png` beside this file, picked
 * up by the file convention (Next copies it onto the Twitter card too).
 *
 * The `openGraph` block is restated in full rather than inherited: a page that
 * declares one *replaces* the layout's instead of merging with it, so anything
 * left out here — og:type, og:site_name, og:locale — simply never renders.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(await requestOrigin()),
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: "/",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
    },
  };
}

const FEATURES = [
  {
    icon: Users,
    title: "Teams & Collaboration",
    desc: "Add teams, bulk import, and invite owners, admins and scorekeepers.",
    iconBg: "bg-primary/15 text-primary",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-primary)]",
  },
  {
    icon: Shuffle,
    title: "Smart Seeding & Groups",
    desc: "Drag-and-drop or random seeding, with top seeds spread across the groups.",
    iconBg: "bg-chart-2/15 text-chart-2",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-chart-2)]",
  },
  {
    icon: BarChart3,
    title: "Live Standings",
    desc: "Round robin standings with tie-breakers, updated after every score.",
    iconBg: "bg-chart-3/15 text-chart-3",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-chart-3)]",
  },
  {
    icon: Network,
    title: "Finals Brackets",
    desc: "The top teams from every group seed into an auto-drawn knockout bracket — no first-round rematches.",
    iconBg: "bg-chart-5/15 text-chart-5",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-chart-5)]",
  },
  {
    icon: CalendarClock,
    title: "Smart Scheduling",
    desc: "Spread matches across courts with automatic slot and court assignment.",
    iconBg: "bg-chart-4/15 text-chart-4",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-chart-4)]",
  },
  {
    icon: CreditCard,
    title: "Online Registrations & Payments",
    desc: "Teams sign up from your public link and upload proof of payment — you just approve.",
    iconBg: "bg-chart-2/15 text-chart-2",
    glow: "group-hover:shadow-[0_0_0_1px_var(--color-chart-2)]",
  },
];

/**
 * Structured data for the marketing page.
 *
 * `SoftwareApplication` is what earns the app a rich result for searches like
 * "pickleball tournament software"; `WebSite` and `Organization` tie the pages
 * of the site to one publisher. Google reads only the JSON, so this stays in
 * sync with the copy below by hand — keep the feature list matching FEATURES.
 */
function structuredData(origin: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}/#organization`,
        name: "Sortbrite",
        url: origin,
        logo: `${origin}/opengraph-image.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        name: "Sortbrite",
        url: origin,
        publisher: { "@id": `${origin}/#organization` },
        inLanguage: "en",
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}/#app`,
        name: "Sortbrite",
        applicationCategory: "SportsApplication",
        operatingSystem: "Web",
        url: origin,
        description:
          "Run pickleball tournaments with round robin groups, finals brackets, smart court scheduling, online registration and live public standings.",
        publisher: { "@id": `${origin}/#organization` },
        featureList: FEATURES.map((f) => f.title),
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
    ],
  };
}

export default async function Home() {
  const user = await getUser();
  const origin = await requestOrigin();
  const showcase = await loadShowcaseTournaments();
  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        // Rendered as-is into the document; the payload is our own constants.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData(origin)),
        }}
      />
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <BrandMark />
        <div className="flex items-center gap-1 sm:gap-2">
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="#how-it-works">How it works</Link>
          </Button>
          <ThemeToggle />
          <Button asChild>
            <Link href={user ? "/dashboard" : "/login"}>
              {user ? "Dashboard" : "Sign in"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col items-center">
        {/* ---------- hero: the court ---------- */}
        <section className="w-full px-4 sm:px-6">
          <div className="relative isolate mx-auto max-w-6xl overflow-hidden rounded-3xl bg-court text-court-foreground shadow-raised">
            <div className="bg-court-lines absolute inset-0 -z-10 opacity-70" aria-hidden />
            <div className="grid items-center gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.25fr_1fr] lg:py-20">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-ball px-3 py-1 font-heading text-xs font-bold uppercase tracking-[0.12em] text-ball-foreground sm:text-sm">
                  <Sparkles className="size-3.5" aria-hidden />
                  <span className="sm:hidden">A Challonge alternative</span>
                  <span className="hidden sm:inline">
                    A Challonge alternative, built for pickleball
                  </span>
                </span>
                <h1 className="mt-5 text-balance text-5xl font-bold uppercase leading-[0.9] sm:text-6xl lg:text-7xl">
                  Run pickleball tournaments{" "}
                  <span className="text-ball">without the spreadsheets</span>
                </h1>
                <p className="mt-5 max-w-xl text-base text-court-foreground/85 sm:text-lg">
                  Round robin groups, finals brackets, smart court scheduling and
                  live public standings. Built for organizers, loved by players.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button
                    asChild
                    size="lg"
                    className="h-13 rounded-xl bg-ball px-7 text-base font-bold text-ball-foreground shadow-none hover:bg-[color-mix(in_oklch,var(--ball),white_15%)] sm:h-13"
                  >
                    <Link href={user ? "/dashboard/tournaments/new" : "/login"}>
                      Create a tournament <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="h-13 rounded-xl border-court-foreground/30 bg-transparent px-7 text-base font-bold text-court-foreground hover:bg-court-foreground/10 hover:text-court-foreground sm:h-13 dark:border-court-foreground/30 dark:bg-transparent"
                  >
                    <Link href="#how-it-works">See how it works</Link>
                  </Button>
                </div>
              </div>

              {/* A sample scoreboard — what players see on the public link. */}
              <div
                aria-hidden
                className="hidden rounded-2xl bg-card p-4 text-card-foreground shadow-raised lg:block"
              >
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Group A · Live</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-ball px-2 py-0.5 font-heading text-xs font-bold uppercase tracking-[0.1em] text-ball-foreground">
                    <span className="size-1.5 rounded-full bg-ball-foreground" />
                    Live
                  </span>
                </div>
                <ol className="mt-3 divide-y divide-border">
                  {[
                    ["1", "Dink Dynasty", "3-0", "+18"],
                    ["2", "Kitchen Kings", "2-1", "+4"],
                    ["3", "Third Shot Drop", "1-2", "-6"],
                    ["4", "Erne Express", "0-3", "-18"],
                  ].map(([rank, team, rec, diff]) => (
                    <li key={rank} className="flex items-center gap-3 py-2.5">
                      <span
                        className={`scoreboard grid size-7 place-items-center rounded-md text-sm font-bold ${Number(rank) <= 2 ? "bg-court text-court-foreground" : "bg-muted text-muted-foreground"}`}
                      >
                        {rank}
                      </span>
                      <span className="flex-1 truncate text-sm font-semibold">
                        {team}
                      </span>
                      <span className="scoreboard text-lg font-bold">{rec}</span>
                      <span className="scoreboard w-10 text-right text-sm text-muted-foreground">
                        {diff}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <HowItWorks />

        {/* ---------- features ---------- */}
        <section
          aria-labelledby="features-heading"
          className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20"
        >
          <p className="eyebrow text-primary">Everything on one court</p>
          <h2
            id="features-heading"
            className="mt-1 text-4xl font-bold uppercase leading-none sm:text-5xl"
          >
            From sign-up to champion
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`group glass relative overflow-hidden rounded-2xl p-6 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-raised ${f.glow}`}
              >
                <span
                  className={`mb-4 grid size-12 place-items-center rounded-xl ${f.iconBg}`}
                >
                  <f.icon className="size-6" aria-hidden />
                </span>
                <h3 className="font-heading text-xl font-bold uppercase leading-tight tracking-wide">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="w-full max-w-6xl px-4 sm:px-6">
          <TournamentMarquee tournaments={showcase} />
        </div>
      </main>

      <footer className="border-t border-border bg-card/60 px-4 py-12 text-center">
        <QrCode className="mx-auto mb-4 size-6 text-primary" aria-hidden />
        <p className="font-heading text-2xl font-bold uppercase tracking-wide sm:text-3xl">
          Built by a pickleball player{" "}
          <span className="text-primary">for pickleball players</span>
        </p>
        <div className="mt-6 flex justify-center">
          <BrandMark />
        </div>
      </footer>
    </div>
  );
}
