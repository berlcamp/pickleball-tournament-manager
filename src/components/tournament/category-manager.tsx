"use client";

import { useOptimistic, useState, useTransition } from "react";
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
import {
  Check,
  Layers,
  Loader2,
  Lock,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { TournamentFormatInfo } from "@/components/tournament/tournament-format-info";
import type { Category } from "@/types";

/** A category as listed: the stored row, or one still being created. */
type ShownCategory = Pick<Category, "id" | "name" | "event_date" | "status"> & {
  saving?: boolean;
};
type CategoryOp =
  | { type: "add"; row: ShownCategory }
  | { type: "remove"; id: string };

export function CategoryManager({
  tournamentId,
  categories,
}: {
  tournamentId: string;
  categories: Category[];
}) {
  const [, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");

  // New and deleted categories show at once; the revalidated props replace
  // this list when the action returns, and a failure falls back to them.
  const [shown, apply] = useOptimistic(
    categories as ShownCategory[],
    (list, op: CategoryOp) =>
      op.type === "add"
        ? [...list, op.row]
        : list.filter((c) => c.id !== op.id),
  );

  function add() {
    const name = newName.trim();
    if (!name) return;
    const date = newDate;
    setNewName("");
    setNewDate("");
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
      if (!res.ok) {
        toast.error(`Couldn't add ${name}: ${res.error}`);
        setNewName((n) => n || name);
        setNewDate((d) => d || date);
        return;
      }
      toast.success(`${name} added`);
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
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Layers className="size-5" />
        </span>
        <div>
          <h2 className="font-heading text-2xl font-bold">Categories</h2>
          <p className="text-sm text-muted-foreground">
            Each category is its own mini-tournament with separate teams,
            groups and finals — and its own play day, shown on the public page.
          </p>
        </div>
      </div>

      <TournamentFormatInfo />

      <ul className="space-y-2">
        {shown.map((c) => (
          <CategoryRow
            key={c.id}
            tournamentId={tournamentId}
            category={c}
            canDelete={shown.length > 1}
            onDelete={() => remove(c)}
          />
        ))}
      </ul>

      <form
        className="space-y-3 rounded-xl border-2 border-dashed border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <p className="eyebrow">Add a category</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full space-y-1.5 sm:flex-1">
            <Label htmlFor="new-cat">Name</Label>
            <Input
              id="new-cat"
              placeholder="e.g. Mixed Doubles"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>
          <div className="w-full space-y-1.5 sm:w-44">
            <Label htmlFor="new-cat-date">
              Day <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="new-cat-date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <Button
            type="submit"
            variant="outline"
            disabled={!newName.trim()}
            className="w-full sm:w-auto"
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </form>
    </section>
  );
}

function CategoryRow({
  tournamentId,
  category,
  canDelete,
  onDelete,
}: {
  tournamentId: string;
  category: ShownCategory;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(category.name);
  const [date, setDate] = useState(category.event_date ?? "");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Once the group stage has started the category is locked — its teams and
  // groups can no longer be changed, and neither can its name. The play date
  // stays editable, since a postponed day still has to reach the public page.
  const locked = category.status !== "draft";
  const dirty = name !== category.name || date !== (category.event_date ?? "");
  // A row still being created has no id on the server to save against yet.
  const creating = Boolean(category.saving);

  function save() {
    startTransition(async () => {
      const res = await updateCategory(tournamentId, category.id, {
        name: name.trim(),
        event_date: date,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <li className="space-y-1.5 rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && dirty && name.trim() && save()}
          className="flex-1"
          disabled={locked || creating}
          aria-label="Category name"
          aria-invalid={!name.trim()}
        />
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setSaved(false);
            }}
            className="flex-1 sm:w-44 sm:flex-none"
            disabled={creating}
            aria-label={`${category.name} play date`}
            title="The day this category is played"
          />
          {creating ? (
            <Loader2
              className="mx-2 size-4 animate-spin text-muted-foreground"
              aria-label="Adding"
            />
          ) : (
            <>
              <Button
                variant={dirty ? "default" : "ghost"}
                size={dirty ? "default" : "icon"}
                onClick={save}
                disabled={pending || !dirty || !name.trim()}
                aria-label="Save category"
                className={saved ? "text-primary" : undefined}
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : saved ? (
                  <Check className="size-4" />
                ) : (
                  <Save className="size-4" />
                )}
                {dirty && !pending && <span>Save</span>}
              </Button>
              {!locked && canDelete && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setConfirmDelete(true)}
                  aria-label={`Delete ${category.name}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>
      {locked ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          Started — only the play day can still change.
        </p>
      ) : !name.trim() ? (
        <p className="text-xs text-destructive">A category needs a name.</p>
      ) : saved ? (
        <p className="text-xs text-primary" aria-live="polite">
          Saved
        </p>
      ) : null}

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
