"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
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
  const [name, setName] = useState(raffle?.name ?? "");
  const [description, setDescription] = useState(raffle?.description ?? "");
  const router = useRouter();

  function onOpenChange(next: boolean) {
    if (next) {
      setName(raffle?.name ?? "");
      setDescription(raffle?.description ?? "");
    }
    setOpen(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name is required.");
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
    router.refresh();
  }

  const defaultTrigger = isEdit ? (
    <Button variant="outline" size="sm">
      <Pencil className="size-3.5" />
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
          <DialogTitle>{isEdit ? "Edit raffle" : "New raffle"}</DialogTitle>
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
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="raffle-desc">Description</Label>
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
