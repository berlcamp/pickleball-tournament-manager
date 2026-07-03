"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clearGroups, generateGroups } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Network, Trash2 } from "lucide-react";

export function GroupGenerator({
  tournamentId,
  categoryId,
  participantCount,
  hasGroups,
}: {
  tournamentId: string;
  categoryId: string;
  participantCount: number;
  hasGroups: boolean;
}) {
  const router = useRouter();
  const suggested = Math.max(1, Math.min(4, Math.floor(participantCount / 4)));
  const [num, setNum] = useState(suggested || 1);
  const [pending, startTransition] = useTransition();
  const [confirmClear, setConfirmClear] = useState(false);

  function generate() {
    startTransition(async () => {
      const res = await generateGroups(tournamentId, categoryId, num);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${num} groups generated with snake seeding`);
    });
  }

  function clear() {
    startTransition(async () => {
      const res = await clearGroups(tournamentId, categoryId);
      if (!res.ok) { toast.error(res.error); return; }
      setConfirmClear(false);
      toast.success("Groups cleared");
      router.refresh();
    });
  }

  return (
    <div className="glass space-y-4 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <Network className="size-5" />
        </span>
        <div>
          <h3 className="font-semibold">Generate groups</h3>
          <p className="text-sm text-muted-foreground">
            Snake seeding evenly distributes {participantCount} teams.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="num">Number of groups</Label>
          <Input
            id="num"
            type="number"
            min={1}
            max={26}
            value={num}
            onChange={(e) => setNum(Number(e.target.value))}
            className="w-32"
          />
        </div>
        <Button onClick={generate} disabled={pending}>
          {pending
            ? "Generating…"
            : hasGroups
              ? "Regenerate groups"
              : "Generate groups"}
        </Button>
        {hasGroups && (
          <Button
            variant="outline"
            onClick={() => setConfirmClear(true)}
            disabled={pending}
          >
            <Trash2 className="size-4" />
            Clear all groups
          </Button>
        )}
      </div>
      {hasGroups && (
        <p className="text-xs text-amber-400/80">
          Regenerating will reset existing group matches and standings.
        </p>
      )}

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear all groups?</DialogTitle>
            <DialogDescription>
              This deletes all groups for this category, along with their
              matches and standings. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmClear(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={clear} disabled={pending}>
              <Trash2 className="size-4" />
              {pending ? "Clearing…" : "Clear all groups"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
