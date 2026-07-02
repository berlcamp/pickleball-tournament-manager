"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Maximize, Radio } from "lucide-react";
import { StandingsTable } from "@/components/tournament/standings-table";
import type { GroupVM } from "@/components/tournament/group-stage-view";

export interface MonitorCategory {
  id: string;
  name: string;
  groups: GroupVM[];
}

export function MonitorBoard({
  tournamentName,
  categories,
}: {
  tournamentName: string;
  categories: MonitorCategory[];
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());

  // Auto-refresh data + tick the clock.
  useEffect(() => {
    const refresh = setInterval(() => router.refresh(), 20_000);
    const tick = setInterval(() => setNow(new Date()), 30_000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [router]);

  function goFullscreen() {
    containerRef.current?.requestFullscreen?.();
  }

  const hasStandings = categories.some((c) => c.groups.length > 0);

  return (
    <div ref={containerRef} className="bg-app-gradient min-h-screen bg-background p-6 sm:p-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Radio className="size-5 animate-pulse" />
              <span className="text-sm font-semibold uppercase tracking-widest">
                Live
              </span>
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">{tournamentName}</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-3xl font-bold tabular-nums sm:block">
              {now.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <Button variant="outline" size="icon" onClick={goFullscreen}>
              <Maximize className="size-5" />
            </Button>
          </div>
        </div>

        {!hasStandings ? (
          <p className="glass rounded-2xl p-10 text-center text-muted-foreground">
            Standings will appear once the group stage begins.
          </p>
        ) : (
          <div className="space-y-10">
            {categories
              .filter((c) => c.groups.length > 0)
              .map((c) => (
                <section key={c.id} className="space-y-4">
                  <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                    {c.name}
                  </h2>
                  <div className="grid gap-6 lg:grid-cols-2">
                    {c.groups.map((g) => (
                      <div key={g.id} className="space-y-2">
                        <h3 className="text-lg font-bold">{g.name}</h3>
                        <StandingsTable rows={g.standings} />
                      </div>
                    ))}
                  </div>
                </section>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
