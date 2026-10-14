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
    title: "Match wins",
    body: "The team with more matches won ranks higher.",
  },
  {
    title: "Head-to-head (mini-league)",
    body: "If teams are level on wins, we count wins against the other tied teams only.",
  },
  {
    title: "Set wins",
    body: "Still tied? The team that won more sets across all their matches ranks higher.",
  },
  {
    title: "Point differential",
    body: "Points scored minus points conceded across all matches. A higher net ranks higher.",
  },
  {
    title: "Total points",
    body: "The team that scored more points across all their matches ranks higher.",
  },
  {
    title: "Direct head-to-head",
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
        className="-my-1 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground transition-colors duration-150 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8"
      >
        <HelpCircle className="size-4" />
        <span className="hidden min-[380px]:inline">How are these ranked?</span>
        <span className="min-[380px]:hidden">Ranking rules</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-bold">
              How standings are ranked
            </DialogTitle>
            <DialogDescription>
              Teams are compared in order. The first rule that separates two
              teams decides who ranks higher.
            </DialogDescription>
          </DialogHeader>

          <ol className="space-y-3">
            {RULES.map((r, i) => (
              <li key={r.title} className="flex gap-3">
                <span className="scoreboard grid size-7 shrink-0 place-items-center rounded-lg bg-court text-base font-bold text-court-foreground">
                  {i + 1}
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{r.title}</span>
                  <span className="text-sm text-muted-foreground">{r.body}</span>
                </span>
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
