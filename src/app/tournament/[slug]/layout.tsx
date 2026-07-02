import { notFound } from "next/navigation";
import Link from "next/link";
import { getTournamentBySlug } from "@/lib/data";
import { PublicTabs } from "@/components/public/public-tabs";
import { LiveRefresh } from "@/components/public/live-refresh";
import { formatDate } from "@/lib/format";
import { Trophy, MapPin, Calendar } from "lucide-react";

export default async function PublicTournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournamentBySlug(slug);
  if (!tournament) notFound();

  return (
    <div className="min-h-screen">
      <header className="glass border-b border-white/5">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <Link
            href="/"
            className="mb-3 inline-flex items-center gap-2 text-sm font-bold"
          >
            <Trophy className="size-4 text-primary" />
            <span className="text-gradient">PicklePro</span>
            <span className="hidden font-normal text-muted-foreground sm:inline">
              by Sortbrite
            </span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-4" /> {formatDate(tournament.start_date)}
            </span>
            {tournament.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" /> {tournament.location}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <PublicTabs slug={slug} />
        <div className="pt-6">{children}</div>
      </div>

      <LiveRefresh tournamentId={tournament.id} />
    </div>
  );
}
