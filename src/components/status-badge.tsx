import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TournamentStatus, MatchStatus, StandingStatus } from "@/types";

const TOURNAMENT: Record<TournamentStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  group_stage: { label: "Group Stage", cls: "bg-chart-2/20 text-chart-2" },
  final_stage: { label: "Final Stage", cls: "bg-chart-4/20 text-chart-4" },
  completed: { label: "Completed", cls: "bg-primary/20 text-primary" },
};

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const s = TOURNAMENT[status];
  return <Badge className={cn("border-0", s.cls)}>{s.label}</Badge>;
}

const MATCH: Record<MatchStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
  in_progress: { label: "Live", cls: "bg-chart-3/20 text-chart-3 animate-pulse" },
  completed: { label: "Final", cls: "bg-primary/20 text-primary" },
};

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const s = MATCH[status];
  return <Badge className={cn("border-0", s.cls)}>{s.label}</Badge>;
}

const STANDING: Partial<Record<StandingStatus, { label: string; cls: string }>> =
  {
    advanced: { label: "Advanced", cls: "bg-primary/20 text-primary" },
    qualified: { label: "Qualified", cls: "bg-chart-2/20 text-chart-2" },
    eliminated: { label: "Eliminated", cls: "bg-destructive/15 text-destructive" },
    champion: { label: "Champion", cls: "bg-yellow-500/20 text-yellow-400" },
    runner_up: { label: "Runner Up", cls: "bg-chart-4/20 text-chart-4" },
  };

export function StandingStatusBadge({ status }: { status: StandingStatus }) {
  const s = STANDING[status];
  if (!s) return <span className="text-muted-foreground">—</span>;
  return <Badge className={cn("border-0", s.cls)}>{s.label}</Badge>;
}

export function WLBadge({ result }: { result: "W" | "L" | "T" }) {
  const map = {
    W: "bg-primary/20 text-primary",
    L: "bg-destructive/15 text-destructive",
    T: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-grid size-6 place-items-center rounded-md text-xs font-bold",
        map[result],
      )}
    >
      {result}
    </span>
  );
}
