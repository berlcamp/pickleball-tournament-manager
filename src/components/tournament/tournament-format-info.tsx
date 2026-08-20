import { Info } from "lucide-react";
import { ADVANCE_PER_GROUP } from "@/lib/constants";

/**
 * Every category runs the same two-stage format, so there is nothing to
 * choose here — but organizers still need to know how qualifiers get paired
 * before they run the event, which is exactly when they are on this form.
 */
export function TournamentFormatInfo() {
  return (
    <div className="flex gap-2 rounded-xl border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="space-y-1.5">
        <p>
          Every category runs the same{" "}
          <span className="font-medium text-foreground">two-stage format</span>:
        </p>
        <p>
          <span className="font-medium text-foreground">1. Group stage</span> —
          teams are split into groups by snake seeding and play a round robin
          within their group. The top {ADVANCE_PER_GROUP} of each group
          qualify.
        </p>
        <p>
          <span className="font-medium text-foreground">2. Final stage</span> —
          the group winners are ranked against each other by win rate, then
          point differential, then points. Each group&apos;s runner-up takes
          its seed from where that group&apos;s winner placed, so the two
          halves of a group are always drawn apart.
        </p>
        <p>
          That order is drawn into a single-elimination bracket, best seed
          against weakest, so the two strongest qualifiers can only meet in the
          final. Two teams from the same group are never drawn against each
          other in the first round — they already played in the group stage.
          If the qualifier count isn&apos;t a power of two, the top seeds get a
          bye through the first round. A third-place playoff is always
          included.
        </p>
      </div>
    </div>
  );
}
