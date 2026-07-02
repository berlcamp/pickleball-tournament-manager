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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Save, Info, Lock } from "lucide-react";
import type { Category, FinalBracketType } from "@/types";

const BRACKET_OPTIONS = [
  { label: "Crossover Bracket", value: "crossover" },
  { label: "Standard Seed", value: "standard_seed" },
];

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
  const [newBracket, setNewBracket] = useState<FinalBracketType>("crossover");

  function add() {
    if (!newName.trim()) return;
    startTransition(async () => {
      const res = await createCategory(tournamentId, {
        name: newName.trim(),
        final_bracket_type: newBracket,
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

      <div className="flex gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1.5">
          <p>The bracket type controls how group-stage qualifiers are matched up in the finals:</p>
          <p>
            <span className="font-medium text-foreground">Crossover Bracket</span>{" "}
            — pairs neighboring groups against each other (A1 vs B2, B1 vs A2).
            Winning your group means avoiding the other group&apos;s winner in
            the first round, and two teams from the same group can only meet
            again later. Best when groups are of similar strength.
          </p>
          <p>
            <span className="font-medium text-foreground">Standard Seed</span> —
            ranks every qualifier by overall record across all groups and seeds
            them like a classic bracket (best seed vs weakest, so the top two
            seeds can only meet in the final). Best when groups differ in
            strength and you want to reward the best overall records.
          </p>
          <p className="text-muted-foreground/80">
            Example: 4 qualifiers ranked #1–#4 by overall record play #1 vs #4
            and #2 vs #3 in the semifinals — regardless of which group they came
            from — so the two best teams can only meet in the final.
          </p>
        </div>
      </div>

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

      <div className="flex flex-col gap-2 border-t border-white/5 pt-4 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
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
        <div className="space-y-1.5">
          <Label className="text-xs">Bracket</Label>
          <Select
            items={BRACKET_OPTIONS}
            value={newBracket}
            onValueChange={(v) => setNewBracket(v as FinalBracketType)}
          >
            <SelectTrigger className="min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="crossover">Crossover Bracket</SelectItem>
              <SelectItem value="standard_seed">Standard Seed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={add} disabled={pending || !newName.trim()}>
          <Plus className="size-4" /> Add
        </Button>
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
  const [bracket, setBracket] = useState<FinalBracketType>(
    category.final_bracket_type,
  );
  // Once the group stage has started the category is locked — its teams,
  // groups, and bracket settings can no longer be changed.
  const locked = category.status !== "draft";
  const dirty = name !== category.name || bracket !== category.final_bracket_type;

  function save() {
    startTransition(async () => {
      const res = await updateCategory(tournamentId, category.id, {
        name: name.trim(),
        final_bracket_type: bracket,
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
    <li className="flex flex-col gap-2 rounded-xl border border-white/5 p-3 sm:flex-row sm:items-center">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="flex-1"
        disabled={locked}
      />
      <Select
        items={BRACKET_OPTIONS}
        value={bracket}
        onValueChange={(v) => setBracket(v as FinalBracketType)}
        disabled={locked}
      >
        <SelectTrigger className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="crossover">Crossover Bracket</SelectItem>
          <SelectItem value="standard_seed">Standard Seed</SelectItem>
        </SelectContent>
      </Select>
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
