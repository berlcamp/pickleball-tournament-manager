"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Plus, Pencil } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDepartment, updateDepartment } from "@/actions/raffle";
import type { RaffleDepartment } from "@/types";

interface Props {
  raffleId: string;
  department?: RaffleDepartment;
  trigger?: ReactNode;
}

export function DepartmentFormDialog({ raffleId, department, trigger }: Props) {
  const isEdit = !!department;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Shown under the field rather than as a toast, so it sits where the fix is.
  const [nameError, setNameError] = useState<string | null>(null);
  const [name, setName] = useState(department?.name ?? "");

  function onOpenChange(next: boolean) {
    if (next) {
      setNameError(null);
      setName(department?.name ?? "");
    }
    setOpen(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Give the department a name.");
      return;
    }
    setSubmitting(true);
    const result = isEdit
      ? await updateDepartment({ id: department!.id, name: name.trim() })
      : await createDepartment({ raffle_id: raffleId, name: name.trim() });
    setSubmitting(false);

    if (!result.ok) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Department updated" : "Department added");
    setOpen(false);
  }

  const defaultTrigger = isEdit ? (
    <Button variant="ghost" size="sm">
      <Pencil className="size-3.5" />
      Rename
    </Button>
  ) : (
    <Button variant="outline">
      <Plus className="size-4" />
      Add department
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={(trigger ?? defaultTrigger) as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-bold">{isEdit ? "Rename department" : "Add department"}</DialogTitle>
          <DialogDescription>
            Departments group raffle entries (e.g. Men&apos;s, Women&apos;s,
            Sponsors).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="dept-name">Name</Label>
            <Input
              id="dept-name"
              placeholder="e.g. Sponsors"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "dept-name-error" : undefined}
              autoFocus
            />
            {nameError && (
              <p id="dept-name-error" className="text-xs text-destructive">
                {nameError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
