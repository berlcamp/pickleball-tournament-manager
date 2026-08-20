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

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Tournament settings" description="Edit the details." />
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
      <PublicLinkSettings
        tournamentId={id}
        shortCode={tournament.short_code}
        origin={origin}
      />
      <CategoryManager tournamentId={id} categories={categories} />
      <PaymentSettings tournament={tournament} />
      <RegistrationSettings
        tournamentId={id}
        categories={categories}
        approvedCounts={approvedCounts}
      />
    </div>
  );
}
