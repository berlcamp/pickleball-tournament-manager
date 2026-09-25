"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, ListPlus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteDepartment({ id: department.id });
      if (!result.ok) {
        toast.error("Delete failed", { description: result.error });
        return;
      }
      toast.success("Department deleted");
      setConfirmOpen(false);
      router.refresh();
    });
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <span className="line-clamp-1">{department.name}</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {department.entry_count}
          </span>{" "}
          {department.entry_count === 1 ? "entry" : "entries"}
        </p>
      </CardHeader>
      <CardContent className="mt-auto flex flex-wrap items-center gap-2 pt-0">
        <AddEntriesDialog
          departmentId={department.id}
          departmentName={department.name}
          trigger={
            <Button size="sm" variant="default" className="gap-1.5">
              <ListPlus className="size-3.5" />
              Add names
            </Button>
          }
        />
        <EntriesViewDialog
          departmentId={department.id}
          departmentName={department.name}
          trigger={
            <Button size="sm" variant="outline" className="gap-1.5">
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
                size="sm"
                variant="ghost"
                className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
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
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={onDelete} disabled={pending}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
