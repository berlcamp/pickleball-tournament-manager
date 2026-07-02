"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { startGroupStage } from "@/actions/groupStage";
import { generateFinals } from "@/actions/finals";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/progress-bar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TournamentStatus } from "@/types";
import { Flag, Play, Lock } from "lucide-react";

export function GroupStageControls({
  tournamentId,
  categoryId,
  status,
  canManage,
  matchesDone,
  matchesTotal,
}: {
  tournamentId: string;
  categoryId: string;
  status: TournamentStatus;
  canManage: boolean;
  matchesDone: number;
  matchesTotal: number;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const allScored = matchesTotal > 0 && matchesDone === matchesTotal;
  const progress =
    matchesTotal === 0 ? 0 : Math.round((matchesDone / matchesTotal) * 100);

  function start() {
    startTransition(async () => {
      const res = await startGroupStage(tournamentId, categoryId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConfirmStart(false);
      toast.success("Group stage started");
    });
  }

  function end() {
    startTransition(async () => {
      const res = await generateFinals(tournamentId, categoryId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConfirmEnd(false);
      toast.success("Group stage ended — finals bracket created");
    });
  }

  return (
    <div className="glass flex flex-col gap-4 rounded-2xl p-5">
      {status === "group_stage" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Group stage progress</span>
            <span className="tabular-nums text-muted-foreground">
              {matchesDone} / {matchesTotal} matches scored
            </span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {canManage && status === "draft" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Lock teams, seeding, groups, and the schedule, then open scoring for
            editors.
          </p>
          <Button
            onClick={() => setConfirmStart(true)}
            disabled={pending || matchesTotal === 0}
          >
            <Play className="size-4" />
            Start group stage
          </Button>
        </div>
      )}

      {canManage && status === "group_stage" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {allScored
              ? "All matches scored. End the stage to lock scores and build the finals bracket."
              : "Score all matches to end the group stage."}
          </p>
          <Button
            onClick={() => setConfirmEnd(true)}
            disabled={pending || !allScored}
            variant={allScored ? "default" : "outline"}
          >
            <Flag className="size-4" />
            End group stage & build finals
          </Button>
        </div>
      )}

      {(status === "final_stage" || status === "completed") && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="size-4" />
          Group stage ended — scores are locked. See the Finals tab.
        </div>
      )}

      <Dialog open={confirmStart} onOpenChange={setConfirmStart}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start group stage?</DialogTitle>
            <DialogDescription>
              This locks teams, seeding, groups, and the schedule, and opens
              scoring for editors. You won&apos;t be able to change them once the
              stage starts.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmStart(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={start} disabled={pending}>
              <Play className="size-4" />
              {pending ? "Starting…" : "Start group stage"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End group stage?</DialogTitle>
            <DialogDescription>
              This locks all group scores and builds the finals bracket from the
              current standings. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmEnd(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={end} disabled={pending}>
              <Flag className="size-4" />
              {pending ? "Ending…" : "End group stage & build finals"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
