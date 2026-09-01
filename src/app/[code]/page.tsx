import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getTournamentByPublicRef,
  getPublicCategories,
} from "@/lib/data";
import {
  approvedCountsByCategory,
  registrationsEnabled,
} from "@/lib/registration-data";
import { registrationAvailability } from "@/services/registration";
import { RegistrationFlow } from "@/components/public/registration-flow";
import type { RegistrationCategory } from "@/components/public/registration-types";
import { TriangleAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PublicRegisterPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const tournament = await getTournamentByPublicRef(code);
  if (!tournament) notFound();

  if (!registrationsEnabled()) {
    return (
      <div className="glass flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
        <TriangleAlert className="size-6 text-warning" />
        <h2 className="font-semibold">Online registration is unavailable</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          This server is missing its registration configuration. Please contact
          the organizer to sign up, or view the{" "}
          <Link
            href={`/${code}/standings`}
            className="text-primary underline-offset-4 hover:underline"
          >
            standings
          </Link>
          .
        </p>
      </div>
    );
  }

  const [categories, approved] = await Promise.all([
    getPublicCategories(tournament.id),
    approvedCountsByCategory(tournament.id),
  ]);

  const allCategories: RegistrationCategory[] = categories.map((c) => {
    const approvedCount = approved.get(c.id) ?? 0;
    return {
      id: c.id,
      name: c.name,
      format: c.format,
      fee: Number(c.registration_fee),
      requirePaymentUpfront: c.require_payment_upfront,
      collectShirtSizes: c.collect_shirt_sizes,
      requirePlayerId: c.require_player_id,
      deadline: c.registration_deadline,
      eventDate: c.event_date,
      maxTeams: c.max_teams,
      approvedCount,
      availability: registrationAvailability(c, approvedCount),
    };
  });

  // Only categories actually taking entries reach the browser — a closed one
  // has nothing a registrant can act on, and its fee, deadline and team cap
  // are config we have no reason to publish.
  const openCategories = allCategories.filter((c) => c.availability.open);

  return (
    <RegistrationFlow
      categories={openCategories}
      totalCategories={categories.length}
      payment={{
        name: tournament.payment_name,
        number: tournament.payment_number,
        qr: tournament.payment_qr,
        instructions: tournament.payment_instructions,
      }}
    />
  );
}
