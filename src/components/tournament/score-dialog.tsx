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

interface EditableSet {
  p1: string;
  p2: string;
}

// Keep only digits and drop leading zeros so that typing a non-zero digit into
// a field showing "0" replaces it (e.g. "0" + "5" -> "5"). A lone "0" stays "0".
function normalizeScore(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return "";
  const stripped = digits.replace(/^0+/, "");
  return stripped === "" ? "0" : stripped;
}

function toEditable(sets?: SetScore[]): EditableSet[] {
  if (!sets || !sets.length) return [{ p1: "", p2: "" }];
  return sets.map((s) => ({
    p1: String(s.participant1_score),
    p2: String(s.participant2_score),
  }));
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
  const [sets, setSets] = useState<EditableSet[]>(() => toEditable(initialSets));
  const [pending, startTransition] = useTransition();

  function update(i: number, side: 1 | 2, value: string) {
    const next = normalizeScore(value);
    setSets((prev) =>
      prev.map((s, idx) =>
        idx === i ? { ...s, [side === 1 ? "p1" : "p2"]: next } : s,
      ),
    );
  }

  function submit() {
    const payload: SetScore[] = sets.map((s) => ({
      participant1_score: s.p1 === "" ? 0 : Number(s.p1),
      participant2_score: s.p2 === "" ? 0 : Number(s.p2),
    }));
    startTransition(async () => {
      const res = await onSubmit(payload);
      if (!res.ok) { toast.error(res.error ?? "Failed to save"); return; }
      toast.success("Score saved");
      onOpenChange(false);
    });
  }

  // 1 = team1 wins, 2 = team2 wins, "tie" = equal (but not blank / 0-0), null = incomplete
  function outcome(s: EditableSet): 1 | 2 | "tie" | null {
    if (s.p1 === "" || s.p2 === "") return null;
    const a = Number(s.p1);
    const b = Number(s.p2);
    if (a === b) return a === 0 ? null : "tie";
    return a > b ? 1 : 2;
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
          {sets.map((s, i) => {
            const result = outcome(s);
            const winClass =
              "border-green-500 bg-green-50 text-green-700 focus-visible:ring-green-500 dark:bg-green-950/40 dark:text-green-400";
            return (
              <div
                key={i}
                className="grid grid-cols-[auto_1fr_auto_1fr_auto] items-center gap-2"
              >
                <span className="text-xs text-muted-foreground">
                  Set {i + 1}
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="–"
                  value={s.p1}
                  onChange={(e) => update(i, 1, e.target.value)}
                  className={`text-center ${result === 1 ? winClass : ""}`}
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="–"
                  value={s.p2}
                  onChange={(e) => update(i, 2, e.target.value)}
                  className={`text-center ${result === 2 ? winClass : ""}`}
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
                {result === "tie" ? (
                  <span className="col-span-full text-center text-xs font-medium text-amber-600 dark:text-amber-500">
                    Tie
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-fit"
          onClick={() => setSets((prev) => [...prev, { p1: "", p2: "" }])}
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
