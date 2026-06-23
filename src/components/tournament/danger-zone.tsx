"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { deleteTournament } from "@/actions/tournaments";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export function DangerZone({ tournamentId }: { tournamentId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <div className="glass space-y-3 rounded-2xl border-destructive/30 p-5">
      <h3 className="font-semibold text-destructive">Danger zone</h3>
      <p className="text-sm text-muted-foreground">
        Deleting a tournament permanently removes all teams, matches and
        results.
      </p>
      <Dialog>
        <DialogTrigger render={<Button variant="destructive" size="sm" />}>
          <Trash2 className="size-4" /> Delete tournament
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this tournament?</DialogTitle>
            <DialogDescription>
              This cannot be undone. All data will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const res = await deleteTournament(tournamentId);
                  if (res && !res.ok) toast.error(res.error);
                })
              }
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
