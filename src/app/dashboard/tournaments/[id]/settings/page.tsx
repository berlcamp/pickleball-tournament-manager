import { notFound } from "next/navigation";
import { headers } from "next/headers";
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
import { PublicLinkSettings } from "@/components/tournament/public-link-settings";
import { RegistrationSettings } from "@/components/tournament/registration-settings";

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

  // Build the public origin from the incoming request so the settings card
  // shows the real link players will type.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  const approvedCounts = registrationsEnabled()
    ? Object.fromEntries(await approvedCountsByCategory(id))
    : {};

  const sections = [
    { id: "details", label: "Details" },
    { id: "link", label: "Public link" },
    { id: "categories", label: "Categories" },
    { id: "payment", label: "Payment" },
    { id: "registration", label: "Registration" },
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
            description: tournament.description ?? "",
            location: tournament.location ?? "",
            start_date: tournament.start_date ?? "",
            banner: tournament.banner ?? "",
            show_public_schedule: tournament.show_public_schedule,
          }}
        />
      </div>
      <div id="link" className="scroll-mt-4">
        <PublicLinkSettings
          tournamentId={id}
          shortCode={tournament.short_code}
          origin={origin}
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
    </div>
  );
}
