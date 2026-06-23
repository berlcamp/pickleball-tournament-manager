"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, X } from "lucide-react";

export interface SetScore {
  participant1_score: number;
  participant2_score: number;
}

export function ScoreDialog({
  open,
  onOpenChange,
  team1,
  team2,
  initialSets,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  team1: string;
  team2: string;
  initialSets?: SetScore[];
  onSubmit: (sets: SetScore[]) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [sets, setSets] = useState<SetScore[]>(
    initialSets && initialSets.length
      ? initialSets
      : [{ participant1_score: 0, participant2_score: 0 }],
  );
  const [pending, startTransition] = useTransition();

  function update(i: number, side: 1 | 2, value: number) {
    setSets((prev) =>
      prev.map((s, idx) =>
        idx === i
          ? {
              ...s,
              [side === 1 ? "participant1_score" : "participant2_score"]: value,
            }
          : s,
      ),
    );
  }

  function submit() {
    startTransition(async () => {
      const res = await onSubmit(sets);
      if (!res.ok) { toast.error(res.error ?? "Failed to save"); return; }
      toast.success("Score saved");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enter score</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center text-sm font-medium">
          <span className="truncate text-right">{team1}</span>
          <span className="text-xs text-muted-foreground">vs</span>
          <span className="truncate text-left">{team2}</span>
        </div>

        <div className="space-y-2">
          {sets.map((s, i) => (
            <div
              key={i}
              className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2"
            >
              <span className="text-xs text-muted-foreground">
                Set {i + 1}
              </span>
              <Input
                type="number"
                min={0}
                value={s.participant1_score}
                onChange={(e) => update(i, 1, Number(e.target.value))}
                className="text-center"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                min={0}
                value={s.participant2_score}
                onChange={(e) => update(i, 2, Number(e.target.value))}
                className="text-center"
              />
              {sets.length > 1 ? (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() =>
                    setSets((prev) => prev.filter((_, idx) => idx !== i))
                  }
                >
                  <X className="size-4" />
                </Button>
              ) : (
                <span className="w-9" />
              )}
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() =>
            setSets((prev) => [
              ...prev,
              { participant1_score: 0, participant2_score: 0 },
            ])
          }
        >
          <Plus className="size-4" /> Add set
        </Button>

        <DialogFooter>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Save score"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
