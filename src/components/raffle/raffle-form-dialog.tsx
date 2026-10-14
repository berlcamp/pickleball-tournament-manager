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
import { Textarea } from "@/components/ui/textarea";
import { createRaffle, updateRaffle } from "@/actions/raffle";
import type { Raffle } from "@/types";

interface Props {
  raffle?: Raffle;
  trigger?: ReactNode;
}

export function RaffleFormDialog({ raffle, trigger }: Props) {
  const isEdit = !!raffle;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Shown under the field rather than as a toast, so it sits where the fix is.
  const [nameError, setNameError] = useState<string | null>(null);
  const [name, setName] = useState(raffle?.name ?? "");
  const [description, setDescription] = useState(raffle?.description ?? "");

  function onOpenChange(next: boolean) {
    if (next) {
      setNameError(null);
      setName(raffle?.name ?? "");
      setDescription(raffle?.description ?? "");
    }
    setOpen(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("Give the raffle a name.");
      return;
    }
    setSubmitting(true);
    const payload = { name: name.trim(), description: description.trim() || undefined };
    const result = isEdit
      ? await updateRaffle({ ...payload, id: raffle!.id })
      : await createRaffle(payload);
    setSubmitting(false);

    if (!result.ok) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Raffle updated" : "Raffle created");
    setOpen(false);
  }

  const defaultTrigger = isEdit ? (
    <Button variant="outline">
      <Pencil className="size-4" />
      Edit
    </Button>
  ) : (
    <Button>
      <Plus className="size-4" />
      New raffle
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={(trigger ?? defaultTrigger) as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-bold">{isEdit ? "Edit raffle" : "New raffle"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update raffle name and description."
              : "Give your raffle a name. You'll add departments and entries on the next page."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="raffle-name">Name</Label>
            <Input
              id="raffle-name"
              placeholder="e.g. Season Kickoff 2026"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(null);
              }}
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "raffle-name-error" : undefined}
              autoFocus
            />
            {nameError && (
              <p id="raffle-name-error" className="text-xs text-destructive">
                {nameError}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="raffle-desc">
              Description{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="raffle-desc"
              rows={3}
              placeholder="Optional context shown on the raffle list."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
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
              {isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
