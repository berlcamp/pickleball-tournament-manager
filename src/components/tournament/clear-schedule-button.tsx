"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { clearSchedule } from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export function ClearScheduleButton({
  tournamentId,
  categoryId,
  categoryName,
}: {
  tournamentId: string;
  categoryId: string;
  categoryName: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function clear() {
    startTransition(async () => {
      const res = await clearSchedule(tournamentId, categoryId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Schedule cleared");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="destructive" size="sm">
            <Trash2 />
            Clear schedule
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear schedule?</DialogTitle>
          <DialogDescription>
            This removes every scheduled match and reserved knockout slot for{" "}
            <strong>{categoryName}</strong>. You can regenerate the schedule
            afterward. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" onClick={clear} disabled={pending}>
            {pending ? "Clearing…" : "Clear schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
