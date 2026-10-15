"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateGroups } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { GROUP_COUNTS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Number of groups and the Draw button, for the Groups box on Seeding & Groups. */
export function GroupGenerator({
  tournamentId,
  categoryId,
  participantCount,
  hasGroups = false,
}: {
  tournamentId: string;
  categoryId: string;
  participantCount: number;
  /** Groups already exist, so drawing again replaces them. */
  hasGroups?: boolean;
}) {
  // About four teams a group, capped at 4 groups, rounded down to a count the
  // crossover finals allow.
  const target = Math.min(4, Math.floor(participantCount / 4));
  const suggested = [...GROUP_COUNTS].reverse().find((n) => n <= target) ?? 1;
  const [num, setNum] = useState<number>(suggested);
  const [pending, startTransition] = useTransition();
  // Rough group size, so the organiser can judge the count before drawing.
  const low = Math.floor(participantCount / num);
  const high = Math.ceil(participantCount / num);
  const perGroup = low === high ? `${low}` : `${low}–${high}`;
  // Mirrors the action's own check, so the organiser hears it before pressing.
  const tooFew = participantCount < num * 2;

  function generate() {
    startTransition(async () => {
      const res = await generateGroups(tournamentId, categoryId, num);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Teams drawn into ${num} ${num === 1 ? "group" : "groups"}`);
    });
  }

  // The controls only — the Groups box it sits in carries the heading.
  return (
    <div className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label id="num-groups">Number of groups</Label>
          <div
            role="radiogroup"
            aria-labelledby="num-groups"
            className="flex items-center gap-1"
          >
            {GROUP_COUNTS.map((n) => (
              <Button
                key={n}
                type="button"
                role="radio"
                aria-checked={num === n}
                variant={num === n ? "default" : "outline"}
                size="icon"
                className={cn("scoreboard text-lg font-bold", n >= 10 && "w-11")}
                onClick={() => setNum(n)}
              >
                {n}
              </Button>
            ))}
          </div>
        </div>
        <Button onClick={generate} disabled={pending || tooFew}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Drawing…" : hasGroups ? "Redraw groups" : "Draw groups"}
        </Button>
      </div>
      {tooFew ? (
        <p className="text-xs font-medium text-destructive">
          {num} {num === 1 ? "group needs" : "groups need"} at least {num * 2}{" "}
          teams — this category has {participantCount}. Use fewer groups.
        </p>
      ) : (
      <p className="text-xs text-muted-foreground">
        About <span className="scoreboard text-sm font-bold text-foreground">{perGroup}</span>{" "}
        teams per group. Groups come in 1, 2, 4, 8 or 16 so the finals cross
        over with no byes.
        {hasGroups &&
          " Redrawing replaces the current groups and any manual moves."}
      </p>
      )}
    </div>
  );
}
