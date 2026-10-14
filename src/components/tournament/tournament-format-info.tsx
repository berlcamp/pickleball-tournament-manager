import { Info } from "lucide-react";
import { ADVANCE_PER_GROUP } from "@/lib/constants";

/**
 * Every category runs the same two-stage format, so there is nothing to
 * choose here — but organizers still need to know how qualifiers get paired
 * before they run the event, which is exactly when they are on this form.
 */
export function TournamentFormatInfo() {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground sm:p-4">
      <p className="flex items-center gap-2 text-sm text-foreground">
        <Info className="size-4 shrink-0 text-primary" />
        Every category runs the same{" "}
        <span className="font-semibold">two-stage format</span>
      </p>
      <ol className="space-y-2.5">
        <li className="flex gap-2.5">
          <Step n={1} />
          <p>
            <span className="font-semibold text-foreground">Group stage</span> —
            teams are spread across the groups by seed, so the top seeds start
            in different groups, and play a round robin within their group.
            The top {ADVANCE_PER_GROUP} of each group qualify.
          </p>
        </li>
        <li className="flex gap-2.5">
          <Step n={2} />
          <div className="space-y-1.5">
            <p>
              <span className="font-semibold text-foreground">Final stage</span>{" "}
              — the group winners are ranked against each other by win rate,
              then point differential, then points. Each group&apos;s runner-up
              takes its seed from where that group&apos;s winner placed, so the
              two halves of a group are always drawn apart.
            </p>
            <p>
              That order is drawn into a single-elimination bracket, best seed
              against weakest, so the two strongest qualifiers can only meet in
              the final. Two teams from the same group are never drawn against
              each other in the first round — they already played in the group
              stage. If the qualifier count isn&apos;t a power of two, the top
              seeds get a bye through the first round. A third-place playoff is
              always included.
            </p>
          </div>
        </li>
      </ol>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="scoreboard grid size-6 shrink-0 place-items-center rounded-md bg-court text-sm font-bold text-court-foreground">
      {n}
    </span>
  );
}
