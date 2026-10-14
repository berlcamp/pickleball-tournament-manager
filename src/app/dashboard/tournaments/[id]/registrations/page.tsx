import { notFound } from "next/navigation";
import Link from "next/link";
import { getTournamentContext } from "@/lib/data";
import { roleAtLeast } from "@/lib/constants";
import {
  listRegistrations,
  registrationsEnabled,
} from "@/lib/registration-data";
import { PageHeader, EmptyState } from "@/components/page-header";
import { RegistrationsManager } from "@/components/tournament/registrations-manager";
import { Button } from "@/components/ui/button";
import { Settings2, TriangleAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getTournamentContext(id);
  if (!ctx) notFound();
  const { tournament, role, categories } = ctx;

  const anyOpen = categories.some((c) => c.registration_open);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Registrations"
        description={
          anyOpen
            ? `Teams sign up at /${tournament.short_code}. Check their details and payment, then approve them.`
            : "Open registration for a category in Settings to start accepting teams."
        }
      >
        {roleAtLeast(role, "admin") && (
          <Button asChild variant="outline">
            <Link href={`/dashboard/tournaments/${id}/settings`}>
              <Settings2 className="size-4" /> Registration settings
            </Link>
          </Button>
        )}
      </PageHeader>

      {registrationsEnabled() ? (
        <RegistrationsManager
          tournamentId={id}
          registrations={await listRegistrations(id)}
          categories={categories}
          canManage={roleAtLeast(role, "admin")}
        />
      ) : (
        <EmptyState
          icon={TriangleAlert}
          title="Registration is not set up"
          description="Set SUPABASE_SERVICE_ROLE_KEY in the server environment. Registrant IDs and receipts are stored privately, which requires the service-role key."
        />
      )}
    </div>
  );
}
