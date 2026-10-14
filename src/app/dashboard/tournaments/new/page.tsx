import { PageHeader } from "@/components/page-header";
import { TournamentForm } from "@/components/tournament/tournament-form";

export default function NewTournamentPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New tournament"
        description="Name it and list the categories you will run. Teams, groups and the schedule come next, and everything here can be changed later."
      />
      <TournamentForm />
    </div>
  );
}
