"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TournamentStatusBadge } from "@/components/status-badge";
import { CategoryPresets } from "@/components/tournament/category-presets";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  Layers,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import type { Category } from "@/types";

/** A category as listed: the stored row, or one still being created. */
type ShownCategory = Pick<Category, "id" | "name" | "event_date" | "status"> & {
  saving?: boolean;
};
type CategoryOp =
  | { type: "add"; row: ShownCategory }
  | { type: "remove"; id: string };

/**
 * The tournament's categories as a read-first list — name, play day and
 * stage at a glance, with an Edit button per row — and an add panel that
 * offers the common names as one-tap chips.
 */
export function CategoryManager({
  tournamentId,
  categories,
}: {
  tournamentId: string;
  categories: Category[];
}) {
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);

  // New and deleted categories show at once; the revalidated props replace
  // this list when the action returns, and a failure falls back to them.
  const [shown, apply] = useOptimistic(
    categories as ShownCategory[],
    (list, op: CategoryOp) =>
      op.type === "add"
        ? [...list, op.row]
        : list.filter((c) => c.id !== op.id),
  );

  /** Resolves false when the server refused, so the form can keep the input. */
  function add(name: string, date: string) {
    return new Promise<boolean>((resolve) => {
      startTransition(async () => {
        apply({
          type: "add",
          row: {
            id: `new-${Date.now()}`,
            name,
            event_date: date || null,
            status: "draft",
            saving: true,
          },
        });
        const res = await createCategory(tournamentId, {
          name,
          event_date: date,
        });
        if (!res.ok) toast.error(`Couldn't add ${name}: ${res.error}`);
        resolve(res.ok);
      });
    });
  }

  function remove(c: ShownCategory) {
    startTransition(async () => {
      apply({ type: "remove", id: c.id });
      const res = await deleteCategory(tournamentId, c.id);
      if (!res.ok) {
        toast.error(`Couldn't delete ${c.name}: ${res.error}`);
        return;
      }
      toast.success(`${c.name} deleted`);
    });
  }

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Layers className="size-5" />
        </span>
        <div>
          <h2 className="flex items-center gap-2 font-heading text-2xl font-bold">
            Categories
            <span className="scoreboard rounded-md bg-muted px-1.5 text-base text-muted-foreground">
              {shown.length}
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Each has its own teams, groups, finals and play day.
          </p>
        </div>
      </div>

      <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {shown.map((c, i) => (
          <CategoryRow
            key={c.id}
            index={i}
            tournamentId={tournamentId}
            category={c}
            canDelete={shown.length > 1}
            onDelete={() => remove(c)}
          />
        ))}
      </ol>

      {adding ? (
        <AddCategoryPanel
          used={shown.map((c) => c.name)}
          onAdd={add}
          onClose={() => setAdding(false)}
        />
      ) : (
        <Button
          variant="outline"
          className="h-11 w-full border-dashed"
          onClick={() => setAdding(true)}
        >
          <Plus className="size-4" /> Add category
        </Button>
      )}
    </section>
  );
}

function AddCategoryPanel({
  used,
  onAdd,
  onClose,
}: {
  used: string[];
  onAdd: (name: string, date: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const trimmed = name.trim();
  const duplicate = used.some(
    (n) => n.trim().toLowerCase() === trimmed.toLowerCase(),
  );

  useEffect(() => nameRef.current?.focus(), []);

  async function submit(n: string, d: string) {
    setSubmitting(true);
    // Clear straight away so the next one can be typed while this one saves;
    // put it back if the server refused it.
    setName("");
    setDate("");
    const ok = await onAdd(n, d);
    setSubmitting(false);
    if (!ok) {
      setName((cur) => cur || n);
      setDate((cur) => cur || d);
    }
    nameRef.current?.focus();
  }

  return (
    <form
      className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (trimmed && !duplicate) void submit(trimmed, date);
      }}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex items-center justify-between">
        <p className="font-heading text-lg font-bold">New category</p>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Done
        </Button>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="w-full space-y-1.5 sm:flex-1">
          <Label htmlFor="new-cat">Name</Label>
          <Input
            ref={nameRef}
            id="new-cat"
            placeholder="e.g. Mixed Doubles"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={duplicate}
            aria-describedby={duplicate ? "new-cat-dup" : undefined}
            className="bg-card"
          />
          {duplicate && (
            <p id="new-cat-dup" className="text-xs text-destructive">
              There&apos;s already a category with this name.
            </p>
          )}
        </div>
        <div className="w-full space-y-1.5 sm:w-44">
          <Label htmlFor="new-cat-date">
            Play day <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="new-cat-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="bg-card"
          />
        </div>
        <Button
          type="submit"
          disabled={!trimmed || duplicate}
          className="h-11 w-full sm:mt-6 sm:h-9 sm:w-auto"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          Add
        </Button>
      </div>
      <CategoryPresets used={used} onPick={(n) => void submit(n, date)} />
    </form>
  );
}

function CategoryRow({
  index,
  tournamentId,
  category,
  canDelete,
  onDelete,
}: {
  index: number;
  tournamentId: string;
  category: ShownCategory;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [date, setDate] = useState(category.event_date ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Once the group stage has started the category is locked — its teams and
  // groups can no longer be changed, and neither can its name. The play date
  // stays editable, since a postponed day still has to reach the public page.
  const locked = category.status !== "draft";
  const dirty = name !== category.name || date !== (category.event_date ?? "");
  // A row still being created has no id on the server to save against yet.
  const creating = Boolean(category.saving);

  function startEdit() {
    setName(category.name);
    setDate(category.event_date ?? "");
    setEditing(true);
  }

  function save() {
    if (!dirty) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await updateCategory(tournamentId, category.id, {
        name: name.trim(),
        event_date: date,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${name.trim()} saved`);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <li className="bg-muted/30 p-3 sm:p-4">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) save();
          }}
          onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="w-full space-y-1.5 sm:flex-1">
              <Label htmlFor={`cat-name-${category.id}`}>Name</Label>
              <Input
                id={`cat-name-${category.id}`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={locked}
                autoFocus={!locked}
                aria-invalid={!name.trim()}
                className="bg-card"
              />
              {locked ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Lock className="size-3.5" /> Locked once play has started.
                </p>
              ) : !name.trim() ? (
                <p className="text-xs text-destructive">
                  A category needs a name.
                </p>
              ) : null}
            </div>
            <div className="w-full space-y-1.5 sm:w-44">
              <Label htmlFor={`cat-date-${category.id}`}>Play day</Label>
              <Input
                id={`cat-date-${category.id}`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                autoFocus={locked}
                className="bg-card"
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            {!locked && canDelete && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              >
                <Trash2 className="size-4" /> Delete
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(false)}
              className="sm:ml-auto"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>

        <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {category.name}?</DialogTitle>
              <DialogDescription>
                Its teams, groups, schedule and registrations are deleted with
                it. This can&apos;t be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>
                Keep it
              </DialogClose>
              <Button
                variant="destructive"
                onClick={() => {
                  setConfirmDelete(false);
                  setEditing(false);
                  onDelete();
                }}
              >
                <Trash2 className="size-4" /> Delete category
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </li>
    );
  }

  return (
    <li
      className={cn(
        "flex items-center gap-3 p-3 sm:px-4",
        creating && "opacity-70",
      )}
      aria-busy={creating || undefined}
    >
      <span
        aria-hidden
        className="scoreboard grid size-9 shrink-0 place-items-center rounded-lg bg-court text-lg font-bold text-court-foreground"
      >
        {index + 1}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold leading-tight">{category.name}</p>
        <p
          className={cn(
            "mt-0.5 flex items-center gap-1.5 text-xs",
            category.event_date ? "text-muted-foreground" : "text-warning",
          )}
        >
          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
          {category.event_date
            ? formatDate(category.event_date)
            : "No play day yet"}
        </p>
      </div>
      {creating ? (
        <Loader2
          className="size-4 animate-spin text-muted-foreground"
          aria-label="Adding"
        />
      ) : (
        <>
          <span className="hidden sm:inline-flex">
            <TournamentStatusBadge status={category.status} />
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={startEdit}
            aria-label={`Edit ${category.name}`}
            className="min-h-10 sm:min-h-8"
          >
            <Pencil className="size-4" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
        </>
      )}
    </li>
  );
}
