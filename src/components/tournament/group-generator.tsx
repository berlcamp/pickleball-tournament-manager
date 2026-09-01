"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateGroups } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Network } from "lucide-react";

export function GroupGenerator({
  tournamentId,
  categoryId,
  participantCount,
  hasGroups,
}: {
  tournamentId: string;
  categoryId: string;
  participantCount: number;
  hasGroups: boolean;
}) {
  const suggested = Math.max(1, Math.min(4, Math.floor(participantCount / 4)));
  const [num, setNum] = useState(suggested || 1);
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const res = await generateGroups(tournamentId, categoryId, num);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`Teams assigned across ${num} groups`);
    });
  }

  return (
    <div className="glass space-y-4 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <Network className="size-5" />
        </span>
        <div>
          <h3 className="font-semibold">Automatic group assignment</h3>
          <p className="text-sm text-muted-foreground">
            Distributes {participantCount} teams across the groups by seed.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="num">Number of groups</Label>
          <Input
            id="num"
            type="number"
            min={1}
            max={26}
            value={num}
            onChange={(e) => setNum(Number(e.target.value))}
            className="w-32"
          />
        </div>
        <Button onClick={generate} disabled={pending}>
          {pending ? "Assigning…" : "Automatically Assign to Group"}
        </Button>
      </div>
      {hasGroups && (
        <p className="text-xs text-amber-400/80">
          Re-running this replaces the current groups, their matches and
          standings — including any manual assignments.
        </p>
      )}
    </div>
  );
}
