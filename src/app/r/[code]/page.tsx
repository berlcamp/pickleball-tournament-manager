import Link from "next/link";
import type { Metadata } from "next";
import { getRegistrationByCode, registrationsEnabled } from "@/lib/registration-data";
import { RegistrationStatusCard } from "@/components/public/registration-status-card";
import { RegistrationLookup } from "@/components/public/registration-lookup";
import { TournamentBanner } from "@/components/public/tournament-banner";
import { PublicFooter } from "@/components/public/public-footer";
import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/public/public-header";
import { EmptyState } from "@/components/public/empty-state";
import { SearchX } from "lucide-react";

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
    <div className="flex min-h-screen flex-col">
      <PublicHeader width="max-w-3xl" />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4 sm:px-6 sm:py-6">
        {result ? (
          <>
            <TournamentBanner tournament={result.tournament} compact />
            <RegistrationStatusCard
              registration={result.registration}
              category={result.category}
              tournament={result.tournament}
            />
          </>
        ) : (
          <>
            <EmptyState icon={SearchX} title="Registration not found">
              <p>
                Double-check your reference code — it looks like{" "}
                <span className="font-mono text-foreground">PKL-XXXX-XXXX</span>.
                If you copied it from a message, make sure no characters were
                cut off.
              </p>
              <Button asChild variant="outline" size="lg" className="mt-4">
                <Link href="/">Back to home</Link>
              </Button>
            </EmptyState>
            <RegistrationLookup />
          </>
        )}
      </main>

      <PublicFooter />
    </div>
  );
}
