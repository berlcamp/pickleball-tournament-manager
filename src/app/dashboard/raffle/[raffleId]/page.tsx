import Link from "next/link";
import { ArrowLeft, Building2, TriangleAlert } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RaffleFormDialog } from "@/components/raffle/raffle-form-dialog";
import { OpenDrawButton } from "@/components/raffle/open-draw-button";
import { DepartmentFormDialog } from "@/components/raffle/department-form-dialog";
import { DepartmentCard } from "@/components/raffle/department-card";
import { WinnersTable } from "@/components/raffle/winners-table";
import { getRaffle, getRaffleWinners } from "@/actions/raffle";
import { requireSuperAdmin } from "@/lib/super-admin";

export default async function RaffleDetailPage({
  params,
}: {
  params: Promise<{ raffleId: string }>;
}) {
  const { raffleId } = await params;
  await requireSuperAdmin();

  const [detail, winnersResult] = await Promise.all([
    getRaffle(raffleId),
    getRaffleWinners(raffleId),
  ]);

  if (!detail.ok || !detail.data) {
    return (
      <div className="space-y-6">
        <BackLink />
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {!detail.ok ? detail.error : "Raffle not found."}
        </div>
      </div>
    );
  }

  const { raffle, departments } = detail.data;
  const winners = winnersResult.ok ? winnersResult.data ?? [] : [];
  const totalEntries = departments.reduce((s, d) => s + d.entry_count, 0);

  return (
    <div className="space-y-6">
      <BackLink />

      <PageHeader
        title={raffle.name}
        description={
          raffle.description ??
          (totalEntries > 0
            ? "Names are in. Open the Draw screen on the venue display to spin."
            : "Add a department, then paste its names. The Draw button appears once there are entries.")
        }
      >
        <RaffleFormDialog raffle={raffle} />
        {totalEntries > 0 ? <OpenDrawButton raffleId={raffle.id} /> : null}
      </PageHeader>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Departments", value: departments.length },
          { label: "Entries", value: totalEntries },
          { label: "Winners", value: winners.length },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card p-3 shadow-card sm:p-4"
          >
            <div className="eyebrow truncate">{s.label}</div>
            <div className="scoreboard mt-1 text-3xl font-bold sm:text-4xl">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Departments &amp; Entries</TabsTrigger>
          <TabsTrigger value="winners">Winners ({winners.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="space-y-4">
          <div className="flex justify-end">
            <DepartmentFormDialog raffleId={raffle.id} />
          </div>

          {departments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No departments yet"
              description="Add a department to start collecting names. Each one keeps its own list, so you can draw from one or all of them."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((d) => (
                <DepartmentCard key={d.id} department={d} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="winners">
          <WinnersTable winners={winners} raffleId={raffle.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard/raffle"
      className="inline-flex min-h-11 items-center gap-1 rounded text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-0"
    >
      <ArrowLeft className="size-3.5" />
      All raffles
    </Link>
  );
}
