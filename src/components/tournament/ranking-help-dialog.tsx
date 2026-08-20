"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const RULES: { title: string; body: string }[] = [
  {
    title: "1. Match wins",
    body: "The team with more matches won ranks higher.",
  },
  {
    title: "2. Head-to-head (mini-league)",
    body: "If teams are level on wins, we count wins against the other tied teams only.",
  },
  {
    title: "3. Set wins",
    body: "Still tied? The team that won more sets across all their matches ranks higher.",
  },
  {
    title: "4. Point differential",
    body: "Points scored minus points conceded across all matches. A higher net ranks higher.",
  },
  {
    title: "5. Total points",
    body: "The team that scored more points across all their matches ranks higher.",
  },
  {
    title: "6. Direct head-to-head",
    body: "If two teams are still level, the winner of the match played between those two ranks higher.",
  },
];

export function RankingHelpDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="How standings are ranked"
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <HelpCircle className="size-4" />
        How are these ranked?
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>How standings are ranked</DialogTitle>
            <DialogDescription>
              Teams are compared in order. The first rule that separates two
              teams decides who ranks higher.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-3">
            {RULES.map((r) => (
              <li key={r.title} className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold">{r.title}</span>
                <span className="text-sm text-muted-foreground">{r.body}</span>
              </li>
            ))}
          </ol>

          <p className="text-xs text-muted-foreground">
            If two teams are still exactly level after all rules (including a tied
            head-to-head match), their order is left as-is.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
