import { Info } from "lucide-react";

export function BracketTypeInfo() {
  return (
    <div className="flex gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="space-y-1.5">
        <p>The bracket type controls how group-stage qualifiers are matched up in the finals:</p>
        <p>
          <span className="font-medium text-foreground">Crossover Bracket</span>{" "}
          — pairs neighboring groups against each other (A1 vs B2, B1 vs A2).
          Winning your group means avoiding the other group&apos;s winner in
          the first round, and two teams from the same group can only meet
          again later. Best when groups are of similar strength.
        </p>
        <p>
          <span className="font-medium text-foreground">Standard Seed</span> —
          ranks every qualifier by overall record across all groups and seeds
          them like a classic bracket (best seed vs weakest, so the top two
          seeds can only meet in the final). Best when groups differ in
          strength and you want to reward the best overall records.
        </p>
        <p className="text-muted-foreground/80">
          Example: 4 qualifiers ranked #1–#4 by overall record play #1 vs #4
          and #2 vs #3 in the semifinals — regardless of which group they came
          from — so the two best teams can only meet in the final.
        </p>
      </div>
    </div>
  );
}
