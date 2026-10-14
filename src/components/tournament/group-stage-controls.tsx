"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reopenGroupStage, startGroupStage } from "@/actions/groupStage";
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
import { Eye, Flag, Play, Lock, Undo2 } from "lucide-react";

export function GroupStageControls({
  tournamentId,
  categoryId,
  status,
  canManage,
  canScore = canManage,
  matchesDone,
  matchesTotal,
}: {
  tournamentId: string;
  categoryId: string;
  status: TournamentStatus;
  canManage: boolean;
  /** Whether this viewer may enter scores — explains the read-only view. */
  canScore?: boolean;
  matchesDone: number;
  matchesTotal: number;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmStart, setConfirmStart] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
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

  function reopen() {
    startTransition(async () => {
      const res = await reopenGroupStage(tournamentId, categoryId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setConfirmReopen(false);
      toast.success("Group stage reopened — the category is a draft again");
    });
  }

  return (
    <div className="glass flex flex-col gap-4 rounded-2xl p-4 sm:p-5">
      {status === "group_stage" && (
        <div className="space-y-2">
          <div className="flex items-end justify-between gap-3">
            <span className="eyebrow">Group stage progress</span>
            <span className="flex items-baseline gap-1.5">
              <span className="scoreboard text-3xl font-bold leading-none">
                {matchesDone}
                <span className="text-muted-foreground">/{matchesTotal}</span>
              </span>
              <span className="text-xs text-muted-foreground">scored</span>
            </span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      {status === "draft" && (
        <Notice icon={Lock}>
          {canManage
            ? "Scoring opens once you start the group stage. Starting it locks teams, seeding, groups and the schedule."
            : "Scoring opens once an organiser starts the group stage."}
        </Notice>
      )}

      {status === "group_stage" && !canScore && (
        <Notice icon={Eye}>
          You can follow the scores here, but entering them needs scorekeeper
          access. Ask the tournament owner if you should have it.
        </Notice>
      )}

      {canManage && status === "draft" && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          {matchesTotal === 0 && (
            <p className="text-sm text-muted-foreground sm:mr-auto">
              No matches to play yet — draw the groups first.
            </p>
          )}
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
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {allScored
              ? "Every match is scored. End the stage to lock the scores and draw the finals bracket."
              : `${matchesTotal - matchesDone} ${matchesTotal - matchesDone === 1 ? "match is" : "matches are"} still unscored. The stage can end once every match has a score.`}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {/* Only before the first score: reopening is a plain status flip,
                never a wipe of results that are already in. */}
            {matchesDone === 0 && (
              <Button
                variant="ghost"
                onClick={() => setConfirmReopen(true)}
                disabled={pending}
              >
                <Undo2 className="size-4" />
                Reopen as draft
              </Button>
            )}
            <Button
              onClick={() => setConfirmEnd(true)}
              disabled={pending || !allScored}
              variant={allScored ? "default" : "outline"}
            >
              <Flag className="size-4" />
              End group stage & build finals
            </Button>
          </div>
        </div>
      )}

      {(status === "final_stage" || status === "completed") && (
        <Notice icon={Lock}>
          The group stage is over, so these scores are locked — they decided
          who reached the finals. Knockout scores are entered on the Finals
          tab.
        </Notice>
      )}

      <Dialog open={confirmStart} onOpenChange={setConfirmStart}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-bold">Start group stage?</DialogTitle>
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

      <Dialog open={confirmReopen} onOpenChange={setConfirmReopen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-bold">Reopen as draft?</DialogTitle>
            <DialogDescription>
              Teams, seeding, and groups become editable again. No scores have
              been entered, so nothing is lost — the groups, matches, and
              schedule are all kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmReopen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button onClick={reopen} disabled={pending}>
              <Undo2 className="size-4" />
              {pending ? "Reopening…" : "Reopen as draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmEnd} onOpenChange={setConfirmEnd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-bold">End group stage?</DialogTitle>
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

/** A plain-language note about why something can't be changed right now. */
function Notice({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <p className="flex items-start gap-2.5 text-sm text-muted-foreground">
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
