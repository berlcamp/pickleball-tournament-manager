import { notFound } from "next/navigation";
import Link from "next/link";
import { getTournamentContext } from "@/lib/data";
import { roleAtLeast } from "@/lib/constants";
import {
  listRegistrations,
  registrationsEnabled,
} from "@/lib/registration-data";
import { PageHeader } from "@/components/page-header";
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Registrations"
          description={
            anyOpen
              ? `Teams signing up at /${tournament.short_code}`
              : "Open registration for a category in Settings to start accepting teams."
          }
        />
        {roleAtLeast(role, "admin") && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/dashboard/tournaments/${id}/settings`}>
              <Settings2 className="size-4" /> Registration settings
            </Link>
          </Button>
        )}
      </div>

      {registrationsEnabled() ? (
        <RegistrationsManager
          tournamentId={id}
          registrations={await listRegistrations(id)}
          categories={categories}
          canManage={roleAtLeast(role, "admin")}
        />
      ) : (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl p-10 text-center">
          <TriangleAlert className="size-6 text-warning" />
          <h2 className="font-semibold">Registration is not configured</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Set <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span> in
            the server environment. Registrant IDs and receipts are stored
            privately, which requires the service-role key.
          </p>
        </div>
      )}
    </div>
  );
}
