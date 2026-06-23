"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { timeToMinutes, formatTime } from "@/lib/format";
import { Maximize, Radio } from "lucide-react";
import type { ScheduleRow } from "@/components/tournament/schedule-table";

export function MonitorBoard({
  tournamentName,
  rows,
}: {
  tournamentName: string;
  rows: ScheduleRow[];
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

  const nowMin = now.getHours() * 60 + now.getMinutes();

  const { playing, upcoming } = useMemo(() => {
    const pending = rows
      .filter((r) => r.status !== "completed" && r.time)
      .sort((a, b) => timeToMinutes(a.time!) - timeToMinutes(b.time!));

    if (pending.length === 0) return { playing: [], upcoming: [] };

    // Current slot = latest start time that has begun; else the first slot.
    const started = pending.filter((r) => timeToMinutes(r.time!) <= nowMin);
    const currentSlotTime = started.length
      ? started[started.length - 1].time
      : pending[0].time;

    const playing = pending.filter((r) => r.time === currentSlotTime);
    const upcoming = pending
      .filter((r) => timeToMinutes(r.time!) > timeToMinutes(currentSlotTime!))
      .slice(0, 8);
    return { playing, upcoming };
  }, [rows, nowMin]);

  function goFullscreen() {
    containerRef.current?.requestFullscreen?.();
  }

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

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Now Playing
          </h2>
          {playing.length === 0 ? (
            <p className="glass rounded-2xl p-8 text-center text-muted-foreground">
              No matches in progress.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {playing.map((r) => (
                <div
                  key={r.id}
                  className="glass-strong rounded-2xl border-primary/30 p-5"
                >
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span className="font-semibold text-primary">{r.court}</span>
                    <span>{formatTime(r.time)}</span>
                  </div>
                  <div className="mt-3 space-y-1 text-xl font-bold">
                    <div className="truncate">{r.team1}</div>
                    <div className="text-sm font-normal text-muted-foreground">
                      vs
                    </div>
                    <div className="truncate">{r.team2}</div>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    {r.group}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Upcoming Matches
          </h2>
          {upcoming.length === 0 ? (
            <p className="glass rounded-2xl p-6 text-center text-muted-foreground">
              Nothing else scheduled.
            </p>
          ) : (
            <div className="glass divide-y divide-white/5 rounded-2xl">
              {upcoming.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-4 px-5 py-3.5 text-lg"
                >
                  <span className="w-20 shrink-0 tabular-nums font-semibold text-primary">
                    {formatTime(r.time)}
                  </span>
                  <span className="w-24 shrink-0 text-sm text-muted-foreground">
                    {r.court}
                  </span>
                  <span className="flex-1 truncate">
                    {r.team1}{" "}
                    <span className="text-muted-foreground">vs</span> {r.team2}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
