import { notFound } from "next/navigation";
import Link from "next/link";
import { getTournamentByPublicRef } from "@/lib/data";
import { PublicTabs } from "@/components/public/public-tabs";
import { LiveRefresh } from "@/components/public/live-refresh";
import { TournamentBanner } from "@/components/public/tournament-banner";
import { ThemeToggle } from "@/components/theme-toggle";
import { Trophy } from "lucide-react";

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

  return (
    <div className="min-h-screen">
      {/* Sticky so the brand stays put while a long registration form scrolls. */}
      <header className="glass sticky top-0 z-40 border-b border-white/10">
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
        <TournamentBanner tournament={tournament} />
        <div>
          <PublicTabs code={code} />
          <div className="pt-6">{children}</div>
        </div>
      </div>

      <LiveRefresh tournamentId={tournament.id} />
    </div>
  );
}
