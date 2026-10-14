"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateGroups } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Minus, Network, Plus } from "lucide-react";

const MIN_GROUPS = 1;
const MAX_GROUPS = 26;

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
  const suggested = Math.max(1, Math.min(4, Math.floor(participantCount / 4)));
  const [num, setNum] = useState(suggested || 1);
  const [pending, startTransition] = useTransition();

  const clamp = (n: number) =>
    Math.min(MAX_GROUPS, Math.max(MIN_GROUPS, Number.isFinite(n) ? n : 1));
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

  return (
    <div className="glass flex flex-col gap-4 rounded-2xl p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          <Network className="size-5" />
        </span>
        <div>
          <h3 className="font-heading text-xl font-bold leading-tight">
            2 · Draw groups
          </h3>
          <p className="text-sm text-muted-foreground">
            Spreads the {participantCount} teams across the groups by seed, so
            the top seeds land in different groups.
          </p>
        </div>
      </div>

      <div className="mt-auto flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="num-groups">Number of groups</Label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Fewer groups"
              disabled={num <= MIN_GROUPS}
              onClick={() => setNum((n) => clamp(n - 1))}
            >
              <Minus />
            </Button>
            <input
              id="num-groups"
              type="text"
              inputMode="numeric"
              value={num}
              onChange={(e) =>
                setNum(clamp(Number(e.target.value.replace(/\D/g, "")) || 1))
              }
              className="scoreboard h-11 w-14 rounded-lg border border-input bg-card text-center text-2xl font-bold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-9 dark:bg-input/30"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="More groups"
              disabled={num >= MAX_GROUPS}
              onClick={() => setNum((n) => clamp(n + 1))}
            >
              <Plus />
            </Button>
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
        teams per group.
        {hasGroups &&
          " Redrawing replaces the current groups and any manual moves."}
      </p>
      )}
    </div>
  );
}
