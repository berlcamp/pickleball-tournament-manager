import { Trophy, Medal, Award } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlacementVM } from "@/lib/tournament-data";

/**
 * Placement colours come from the stage tokens in MASTER.md: the lime ball
 * for the champion (the one place it is used as a surface), amber for the
 * runner-up, orange for the next place down. No metallic gradients — they
 * read as decoration and broke in dark mode.
 */
const ORDER: {
  key: string;
  label: string;
  icon: typeof Trophy;
  card: string;
  badge: string;
}[] = [
  {
    key: "champion",
    label: "Champion",
    icon: Trophy,
    card: "border-transparent bg-ball text-ball-foreground",
    badge: "bg-ball-foreground/12 text-ball-foreground",
  },
  {
    key: "runner_up",
    label: "1st Runner Up",
    icon: Medal,
    card: "bg-card",
    badge: "bg-chart-4/15 text-chart-4",
  },
  {
    key: "second_runner_up",
    label: "2nd Runner Up",
    icon: Medal,
    card: "bg-card",
    badge: "bg-chart-3/12 text-chart-3",
  },
  {
    key: "third_place",
    label: "3rd Place",
    icon: Award,
    card: "bg-card",
    badge: "bg-muted text-muted-foreground",
  },
];

export function Podium({ placements }: { placements: PlacementVM[] }) {
  const byKey = new Map(placements.map((p) => [p.placement, p.name]));
  // Only placings that have been decided — an empty "3rd Place" card reads
  // as a bug, not as "not played yet".
  const filled = ORDER.filter((o) => byKey.get(o.key));
  if (filled.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
      {filled.map((o) => {
        const name = byKey.get(o.key);
        const champion = o.key === "champion";
        return (
          <div
            key={o.key}
            className={cn(
              "flex items-center gap-4 rounded-2xl border border-border p-4 shadow-card",
              champion && "bg-court-lines sm:col-span-2 lg:col-span-1",
              o.card,
            )}
          >
            <span
              className={cn(
                "grid size-12 shrink-0 place-items-center rounded-xl",
                o.badge,
              )}
            >
              <o.icon className="size-6" />
            </span>
            <div className="min-w-0">
              <div
                className={cn(
                  "font-heading text-[0.8125rem] font-semibold uppercase tracking-[0.08em]",
                  champion ? "text-ball-foreground/75" : "text-muted-foreground",
                )}
              >
                {o.label}
              </div>
              <div
                className={cn(
                  "font-heading leading-tight font-bold break-words",
                  champion ? "text-2xl sm:text-3xl" : "text-xl text-foreground",
                )}
              >
                {name}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
