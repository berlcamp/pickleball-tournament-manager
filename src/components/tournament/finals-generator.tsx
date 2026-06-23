"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { generateFinals } from "@/actions/finals";
import { Button } from "@/components/ui/button";
import { Network } from "lucide-react";

export function FinalsGenerator({
  tournamentId,
  categoryId,
  hasBracket,
  bracketType,
}: {
  tournamentId: string;
  categoryId: string;
  hasBracket: boolean;
  bracketType: string;
}) {
  const [pending, startTransition] = useTransition();
  function generate() {
    startTransition(async () => {
      const res = await generateFinals(tournamentId, categoryId);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Finals bracket generated");
    });
  }
  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <Network className="size-5" />
        </span>
        <div>
          <h3 className="font-semibold">
            {bracketType === "crossover"
              ? "Crossover bracket"
              : "Standard seed bracket"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Top 2 from each group advance. Requires all group matches complete.
          </p>
        </div>
      </div>
      <Button onClick={generate} disabled={pending} variant={hasBracket ? "outline" : "default"}>
        {pending
          ? "Generating…"
          : hasBracket
            ? "Regenerate bracket"
            : "Generate finals"}
      </Button>
    </div>
  );
}
