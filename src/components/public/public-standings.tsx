"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  StandingsTable,
  type StandingRow,
} from "@/components/tournament/standings-table";
import { EmptyState } from "@/components/public/empty-state";
import { ListOrdered } from "lucide-react";

export interface PublicGroup {
  id: string;
  name: string;
  standings: StandingRow[];
}

/**
 * Group standings on the portal. One group at a time, picked from a row of
 * thumb-sized pills that scrolls sideways when a category has many groups.
 */
export function PublicStandings({
  groups,
}: {
  groups: PublicGroup[];
}) {
  if (groups.length === 0) {
    return (
      <EmptyState icon={ListOrdered} title="No standings yet">
        Groups are drawn once registration closes. The tables fill in live as
        scores come in.
      </EmptyState>
    );
  }
  return (
    <section aria-labelledby="standings-heading" className="space-y-3">
      <h2
        id="standings-heading"
        className="text-2xl font-bold uppercase leading-none"
      >
        Group standings
      </h2>
      <Tabs defaultValue={groups[0].id} className="gap-3">
        {groups.length > 1 && (
          <TabsList
            variant="line"
            className="no-scrollbar -mx-1 flex w-auto justify-start gap-2 overflow-x-auto px-1 py-0.5 group-data-horizontal/tabs:h-auto"
          >
            {groups.map((g) => (
              <TabsTrigger
                key={g.id}
                value={g.id}
                className="min-h-11 flex-none rounded-full border border-border bg-card px-4 font-heading text-[0.95rem] font-semibold uppercase tracking-wide text-muted-foreground after:hidden hover:text-foreground data-active:border-court data-active:bg-court data-active:text-court-foreground group-data-[variant=line]/tabs-list:data-active:bg-court dark:data-active:border-court dark:data-active:bg-court dark:group-data-[variant=line]/tabs-list:data-active:bg-court sm:min-h-10"
              >
                {g.name}
              </TabsTrigger>
            ))}
          </TabsList>
        )}
        {groups.map((g) => (
          <TabsContent key={g.id} value={g.id}>
            <StandingsTable rows={g.standings} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
