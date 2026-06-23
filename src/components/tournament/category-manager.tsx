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
import { Plus, Trash2, Save } from "lucide-react";
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
      />
      <Select
        items={BRACKET_OPTIONS}
        value={bracket}
        onValueChange={(v) => setBracket(v as FinalBracketType)}
      >
        <SelectTrigger className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="crossover">Crossover Bracket</SelectItem>
          <SelectItem value="standard_seed">Standard Seed</SelectItem>
        </SelectContent>
      </Select>
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
    </li>
  );
}
