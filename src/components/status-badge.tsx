import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TournamentStatus, MatchStatus, StandingStatus } from "@/types";

const TOURNAMENT: Record<TournamentStatus, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-muted text-muted-foreground" },
  group_stage: { label: "Group Stage", cls: "bg-chart-2/12 text-chart-2" },
  final_stage: { label: "Final Stage", cls: "bg-chart-3/12 text-chart-3" },
  completed: { label: "Completed", cls: "bg-primary/12 text-primary" },
};

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  const s = TOURNAMENT[status];
  return <Badge className={cn("border-0", s.cls)}>{s.label}</Badge>;
}

const MATCH: Record<MatchStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
  in_progress: { label: "Live", cls: "bg-ball text-ball-foreground" },
  completed: { label: "Final", cls: "bg-primary/12 text-primary" },
};

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  const s = MATCH[status];
  return (
    <Badge className={cn("border-0 font-semibold", s.cls)}>
      {status === "in_progress" && (
        <span className="relative mr-0.5 flex size-1.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-ball-foreground/60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-ball-foreground" />
        </span>
      )}
      {s.label}
    </Badge>
  );
}

const STANDING: Partial<Record<StandingStatus, { label: string; cls: string }>> =
  {
    advanced: { label: "Advanced", cls: "bg-primary/12 text-primary" },
    qualified: { label: "Qualified", cls: "bg-chart-2/12 text-chart-2" },
    eliminated: { label: "Eliminated", cls: "bg-destructive/10 text-destructive" },
    champion: { label: "Champion", cls: "bg-ball text-ball-foreground" },
    runner_up: { label: "Runner Up", cls: "bg-chart-4/15 text-chart-4" },
  };

export function StandingStatusBadge({ status }: { status: StandingStatus }) {
  const s = STANDING[status];
  if (!s) return <span className="text-muted-foreground">—</span>;
  return <Badge className={cn("border-0", s.cls)}>{s.label}</Badge>;
}

export function WLBadge({ result }: { result: "W" | "L" | "T" }) {
  const map = {
    W: "bg-primary text-primary-foreground",
    L: "bg-destructive/12 text-destructive",
    T: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "scoreboard inline-grid size-6 place-items-center rounded-md text-sm font-bold",
        map[result],
      )}
    >
      {result}
    </span>
  );
}
