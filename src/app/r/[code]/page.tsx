import Link from "next/link";
import type { Metadata } from "next";
import { getRegistrationByCode, registrationsEnabled } from "@/lib/registration-data";
import { RegistrationStatusCard } from "@/components/public/registration-status-card";
import { RegistrationLookup } from "@/components/public/registration-lookup";
import { TournamentBanner } from "@/components/public/tournament-banner";
import { PublicFooter } from "@/components/public/public-footer";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchX, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

/** The code is a credential — keep these pages out of search indexes. */
export const metadata: Metadata = {
  title: "Registration status",
  robots: { index: false, follow: false },
};

export default async function RegistrationStatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const result = registrationsEnabled()
    ? await getRegistrationByCode(code)
    : null;

  return (
    <div className="min-h-screen">
      <header className="glass sticky top-0 z-40 border-b border-white/10">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
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

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
        {result ? (
          <>
            <TournamentBanner tournament={result.tournament} />
            <RegistrationStatusCard
              registration={result.registration}
              category={result.category}
              tournament={result.tournament}
            />
          </>
        ) : (
          <>
            <div className="glass flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
              <SearchX className="size-7 text-muted-foreground" />
              <h1 className="text-lg font-semibold">
                We couldn&apos;t find that registration
              </h1>
              <p className="max-w-md text-sm text-muted-foreground">
                Double-check your reference code — it looks like{" "}
                <span className="font-mono">PKL-XXXX-XXXX</span>. If you copied
                it from a message, make sure no characters were cut off.
              </p>
              <Button asChild variant="outline" className="mt-2">
                <Link href="/">Back to home</Link>
              </Button>
            </div>
            <RegistrationLookup />
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
