import { PageHeader } from "@/components/page-header";
import { TournamentForm } from "@/components/tournament/tournament-form";

export default function NewTournamentPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New tournament"
        description="Set up the basics — you can add teams and configure stages next."
      />
      <TournamentForm />
    </div>
  );
}
