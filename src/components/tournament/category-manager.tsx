"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Save, Lock } from "lucide-react";
import { TournamentFormatInfo } from "@/components/tournament/tournament-format-info";
import type { Category } from "@/types";

export function CategoryManager({
  tournamentId,
  categories,
}: {
  tournamentId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");

  function add() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const res = await createCategory(tournamentId, {
        name: newName.trim(),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Category added");
      setNewName("");
      router.refresh();
    });
  }

  return (
    <div className="glass space-y-4 rounded-2xl p-6">
      <div>
        <h3 className="font-semibold">Categories</h3>
        <p className="text-sm text-muted-foreground">
          Each category is its own sub-tournament with separate teams, groups,
          and finals.
        </p>
      </div>

      <TournamentFormatInfo />

      <ul className="space-y-2">
        {categories.map((c) => (
          <CategoryRow
            key={c.id}
            tournamentId={tournamentId}
            category={c}
            canDelete={categories.length > 1}
          />
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row sm:items-end">
        <div className="w-full space-y-1.5 sm:flex-1">
          <Label htmlFor="new-cat" className="text-xs">
            New category
          </Label>
          <Input
            id="new-cat"
            placeholder="e.g. Mixed Doubles"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
        </div>
        <div className="w-full space-y-1.5 sm:w-auto">
          <Label className="hidden text-xs sm:block sm:invisible">Add</Label>
          <Button
            onClick={add}
            disabled={pending || !newName.trim()}
            className="w-full sm:w-auto"
          >
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function CategoryRow({
  tournamentId,
  category,
  canDelete,
}: {
  tournamentId: string;
  category: Category;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(category.name);
  // Once the group stage has started the category is locked — its teams and
  // groups can no longer be changed.
  const locked = category.status !== "draft";
  const dirty = name !== category.name;

  function save() {
    startTransition(async () => {
      const res = await updateCategory(tournamentId, category.id, {
        name: name.trim(),
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Category updated");
      router.refresh();
    });
  }

  function del() {
    startTransition(async () => {
      const res = await deleteCategory(tournamentId, category.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Category deleted");
      router.refresh();
    });
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border/50 p-3 sm:flex-row sm:items-center">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1"
        disabled={locked}
      />
      {locked ? (
        <div
          className="flex items-center gap-1.5 px-2 text-xs text-muted-foreground"
          title="The group stage has started, so this category is locked."
        >
          <Lock className="size-3.5" />
          <span>Locked</span>
        </div>
      ) : (
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={save}
            disabled={pending || !dirty || !name.trim()}
            title="Save"
          >
            <Save className="size-4" />
          </Button>
          {canDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={del}
              disabled={pending}
              title="Delete"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}
