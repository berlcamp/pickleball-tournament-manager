import { notFound } from "next/navigation";
import { getTournamentContext } from "@/lib/data";
import { roleAtLeast } from "@/lib/constants";
import {
  approvedCountsByCategory,
  registrationsEnabled,
} from "@/lib/registration-data";
import { PageHeader } from "@/components/page-header";
import { TournamentForm } from "@/components/tournament/tournament-form";
import { CategoryManager } from "@/components/tournament/category-manager";
import { PaymentSettings } from "@/components/tournament/payment-settings";
import { RegistrationSettings } from "@/components/tournament/registration-settings";
import { ShareCard } from "@/components/tournament/share-card";
import { requestOrigin } from "@/lib/site-url";

export default async function TournamentSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getTournamentContext(id);
  if (!ctx) notFound();
  const { tournament, role, categories } = ctx;
  if (!roleAtLeast(role, "admin")) notFound();

  const [approvedCounts, origin] = await Promise.all([
    registrationsEnabled()
      ? approvedCountsByCategory(id).then((m) => Object.fromEntries(m))
      : Promise.resolve({} as Record<string, number>),
    requestOrigin(),
  ]);

  const sections = [
    { id: "details", label: "Details" },
    { id: "categories", label: "Categories" },
    { id: "payment", label: "Payment" },
    { id: "registration", label: "Registration" },
    { id: "share", label: "QR code" },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        description="Each section saves on its own, so change one thing at a time."
      />
      {/* A long page on a phone: jump straight to the section you came for. */}
      <nav
        aria-label="Settings sections"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex min-h-10 shrink-0 items-center rounded-full border border-border bg-card px-4 text-sm font-medium text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8"
          >
            {s.label}
          </a>
        ))}
      </nav>
      <div id="details" className="scroll-mt-4">
        <TournamentForm
          tournamentId={id}
          defaults={{
            name: tournament.name,
            location: tournament.location ?? "",
          }}
        />
      </div>
      <div id="categories" className="scroll-mt-4">
        <CategoryManager tournamentId={id} categories={categories} />
      </div>
      <div id="payment" className="scroll-mt-4">
        <PaymentSettings tournament={tournament} />
      </div>
      <div id="registration" className="scroll-mt-4">
        <RegistrationSettings
          tournamentId={id}
          categories={categories}
          approvedCounts={approvedCounts}
        />
      </div>
      <div id="share" className="scroll-mt-4">
        <ShareCard
          url={`${origin}/${tournament.short_code}`}
          code={tournament.short_code}
          name={tournament.name}
        />
      </div>
    </div>
  );
}
