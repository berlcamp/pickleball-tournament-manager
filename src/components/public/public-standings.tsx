"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  StandingsTable,
  type StandingRow,
} from "@/components/tournament/standings-table";

export interface PublicGroup {
  id: string;
  name: string;
  standings: StandingRow[];
}

export function PublicStandings({ groups }: { groups: PublicGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="glass rounded-2xl p-10 text-center text-muted-foreground">
        Standings will appear once the group stage begins.
      </p>
    );
  }
  return (
    <Tabs defaultValue={groups[0].id} className="space-y-4">
      <TabsList className="flex-wrap">
        {groups.map((g) => (
          <TabsTrigger key={g.id} value={g.id}>
            {g.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {groups.map((g) => (
        <TabsContent key={g.id} value={g.id}>
          <StandingsTable rows={g.standings} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
