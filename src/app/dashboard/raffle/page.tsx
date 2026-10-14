import Link from "next/link";
import { ArrowRight, Ticket, TriangleAlert } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { RaffleFormDialog } from "@/components/raffle/raffle-form-dialog";
import { PageHeader, EmptyState } from "@/components/page-header";
import { getRaffles } from "@/actions/raffle";
import { requireSuperAdmin } from "@/lib/super-admin";

export default async function RaffleListPage() {
  await requireSuperAdmin();
  const result = await getRaffles();
  const raffles = result.ok ? result.data ?? [] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Raffle"
        description="Run electronic raffle draws. Create a raffle, add departments and their names, then open the Draw screen to spin."
      >
        <RaffleFormDialog />
      </PageHeader>

      {!result.ok ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          Couldn&apos;t load raffles: {result.error}
        </div>
      ) : raffles.length === 0 ? (
        <EmptyState
          icon={Ticket}
          title="No raffles yet"
          description="Create your first raffle to start adding departments and names."
        >
          <RaffleFormDialog />
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {raffles.map((r) => (
            <li key={r.id}>
              <Link
                href={`/dashboard/raffle/${r.id}`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-card outline-none transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raised focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="line-clamp-2 text-2xl font-bold leading-[1.05]">
                    {r.name}
                  </h2>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-ball text-ball-foreground">
                    <Ticket className="size-5" />
                  </span>
                </div>
                {r.description ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {r.description}
                  </p>
                ) : null}
                <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">
                    Created {formatDistanceToNowStrict(new Date(r.created_at))}{" "}
                    ago
                  </span>
                  <span className="flex items-center gap-1 font-semibold text-primary">
                    Open
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
