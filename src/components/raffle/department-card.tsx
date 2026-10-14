"use client";

import { useState, useTransition } from "react";
import { Eye, ListPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DepartmentFormDialog } from "./department-form-dialog";
import { AddEntriesDialog } from "./add-entries-dialog";
import { EntriesViewDialog } from "./entries-view-dialog";
import { deleteDepartment } from "@/actions/raffle";
import type { RaffleDepartment } from "@/types";

type Department = RaffleDepartment & { entry_count: number };

interface Props {
  department: Department;
}

export function DepartmentCard({ department }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Hidden the moment deletion is confirmed; the revalidated page drops it for
  // real, and a failure brings the card back.
  const [removed, setRemoved] = useState(false);
  const [, startTransition] = useTransition();

  function onDelete() {
    setConfirmOpen(false);
    setRemoved(true);
    startTransition(async () => {
      const result = await deleteDepartment({ id: department.id });
      if (!result.ok) {
        setRemoved(false);
        toast.error(`Couldn't delete ${department.name}`, {
          description: result.error,
        });
        return;
      }
      toast.success(`${department.name} deleted`);
    });
  }

  if (removed) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <h3 className="line-clamp-2 font-heading text-xl font-bold leading-tight">
          {department.name}
        </h3>
        <div className="shrink-0 text-right">
          <div className="scoreboard text-3xl font-bold leading-none">
            {department.entry_count}
          </div>
          <div className="eyebrow text-[0.7rem]">
            {department.entry_count === 1 ? "name" : "names"}
          </div>
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <AddEntriesDialog
          departmentId={department.id}
          departmentName={department.name}
          trigger={
            <Button
              size="sm"
              variant={department.entry_count === 0 ? "default" : "outline"}
              className="gap-1.5"
            >
              <ListPlus className="size-3.5" />
              Add names
            </Button>
          }
        />
        <EntriesViewDialog
          departmentId={department.id}
          departmentName={department.name}
          trigger={
            <Button size="sm" variant="ghost" className="gap-1.5">
              <Eye className="size-3.5" />
              View
            </Button>
          }
        />
        <DepartmentFormDialog raffleId={department.raffle_id} department={department} />
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogTrigger
            render={
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Delete ${department.name}`}
                className="ml-auto text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </Button>
            }
          />
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete this department?</DialogTitle>
              <DialogDescription>
                This deletes <span className="font-medium">{department.name}</span>{" "}
                and all {department.entry_count} entries inside it. Winners
                previously drawn from this department remain in history. This
                cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={onDelete}>
                <Trash2 className="size-4" /> Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
