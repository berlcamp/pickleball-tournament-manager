import { Trophy, Medal, Award } from "lucide-react";
import type { PlacementVM } from "@/lib/tournament-data";

const ORDER: { key: string; label: string; icon: typeof Trophy; cls: string }[] =
  [
    {
      key: "champion",
      label: "Champion",
      icon: Trophy,
      cls: "from-yellow-500/30 to-yellow-500/5 text-yellow-400",
    },
    {
      key: "runner_up",
      label: "1st Runner Up",
      icon: Medal,
      cls: "from-slate-300/20 to-transparent text-slate-200",
    },
    {
      key: "second_runner_up",
      label: "2nd Runner Up",
      icon: Medal,
      cls: "from-amber-700/30 to-transparent text-amber-500",
    },
    {
      key: "third_place",
      label: "3rd Place",
      icon: Award,
      cls: "from-muted/40 to-transparent text-muted-foreground",
    },
  ];

export function Podium({ placements }: { placements: PlacementVM[] }) {
  const byKey = new Map(placements.map((p) => [p.placement, p.name]));
  const filled = ORDER.filter((o) => byKey.get(o.key));
  if (filled.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {ORDER.map((o) => {
        const name = byKey.get(o.key);
        return (
          <div
            key={o.key}
            className={`glass rounded-2xl bg-gradient-to-b p-5 text-center ${o.cls}`}
          >
            <o.icon className="mx-auto size-8" />
            <div className="mt-2 text-xs font-semibold uppercase tracking-wide opacity-80">
              {o.label}
            </div>
            <div className="mt-1 text-lg font-bold text-foreground">
              {name ?? "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}
