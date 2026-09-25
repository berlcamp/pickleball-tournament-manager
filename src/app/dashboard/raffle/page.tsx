import Link from "next/link";
import { ArrowRight, Ticket } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { RaffleFormDialog } from "@/components/raffle/raffle-form-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { getRaffles } from "@/actions/raffle";

export default async function RaffleListPage() {
  const result = await getRaffles();
  const raffles = result.ok ? result.data ?? [] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-heading text-2xl font-bold">Raffle</h1>
          <p className="text-sm text-muted-foreground">
            Run electronic raffle draws. Create a raffle, add departments and
            entries, then open the Draw page to spin.
          </p>
        </div>
        <RaffleFormDialog />
      </div>

      {!result.ok ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load raffles: {result.error}
        </div>
      ) : raffles.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Ticket className="size-10 text-muted-foreground" />
            <div className="space-y-1">
              <h3 className="font-semibold">No raffles yet</h3>
              <p className="text-sm text-muted-foreground">
                Create your first raffle to start adding departments and entries.
              </p>
            </div>
            <RaffleFormDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {raffles.map((r) => (
            <Card key={r.id} className="flex flex-col">
              <CardHeader>
                <CardTitle className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2">{r.name}</span>
                  <Ticket className="size-4 shrink-0 text-primary" />
                </CardTitle>
                {r.description ? (
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {r.description}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="mt-auto flex items-center justify-between gap-2 pt-0">
                <span className="text-xs text-muted-foreground">
                  Created {formatDistanceToNowStrict(new Date(r.created_at))} ago
                </span>
                <Link
                  href={`/dashboard/raffle/${r.id}`}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  Open
                  <ArrowRight className="size-3.5" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
