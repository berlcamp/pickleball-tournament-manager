import { notFound } from "next/navigation";
import { getTournamentContext } from "@/lib/data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader } from "@/components/page-header";
import { TournamentForm } from "@/components/tournament/tournament-form";
import { CategoryManager } from "@/components/tournament/category-manager";

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
      <CategoryManager tournamentId={id} categories={categories} />
    </div>
  );
}
