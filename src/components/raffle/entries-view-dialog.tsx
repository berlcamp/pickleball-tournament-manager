"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Eraser, Loader2, Pencil, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearDepartmentEntries,
  deleteEntry,
  getEntriesForDepartment,
  updateEntry,
} from "@/actions/raffle";
import type { RaffleEntry } from "@/types";

interface Props {
  departmentId: string;
  departmentName: string;
  trigger: ReactNode;
}

export function EntriesViewDialog({ departmentId, departmentName, trigger }: Props) {
  const [open, setOpen] = useState(false);
  // null = "not loaded yet" so we can show a loading state.
  const [entries, setEntries] = useState<RaffleEntry[] | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [clearOpen, setClearOpen] = useState(false);
  const [editing, setEditing] = useState<RaffleEntry | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesignation, setEditDesignation] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getEntriesForDepartment(departmentId).then((res) => {
      if (cancelled) return;
      if (!res.ok) {
        toast.error("Failed to load entries", { description: res.error });
        setEntries([]);
      } else {
        setEntries(res.data ?? []);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, departmentId]);

  // The list is local state loaded on open, so edits and removals change it
  // first and put the old row back if the server says no.
  function onDeleteEntry(entry: RaffleEntry) {
    const before = entries;
    setEntries((prev) => (prev ?? []).filter((e) => e.id !== entry.id));
    void deleteEntry({ id: entry.id }).then((res) => {
      if (!res.ok) {
        setEntries(before);
        toast.error(`Couldn't remove ${entry.name}`, { description: res.error });
      }
    });
  }

  function openEdit(entry: RaffleEntry) {
    setEditError(null);
    setEditing(entry);
    setEditName(entry.name);
    setEditDesignation(entry.designation ?? "");
  }

  function onSaveEdit() {
    if (!editing) return;
    const name = editName.trim();
    if (!name) {
      setEditError("A name is needed.");
      return;
    }
    const before = entries;
    const id = editing.id;
    const designation = editDesignation.trim() || null;
    setEntries((prev) =>
      (prev ?? []).map((e) => (e.id === id ? { ...e, name, designation } : e)),
    );
    setEditing(null);
    void updateEntry({
      id,
      name,
      designation: designation ?? undefined,
    }).then((res) => {
      if (!res.ok) {
        setEntries(before);
        toast.error("Couldn't save that change", { description: res.error });
      }
    });
  }

  function onClearAll() {
    startTransition(async () => {
      const res = await clearDepartmentEntries({ department_id: departmentId });
      if (!res.ok) {
        toast.error("Clear failed", { description: res.error });
        return;
      }
      toast.success(`Removed ${res.data?.deleted ?? 0} entries`);
      setEntries([]);
      setClearOpen(false);
    });
  }

  const loading = entries === null;
  const list = entries ?? [];

  const filtered = query.trim()
    ? list.filter((e) => {
        const q = query.trim().toLowerCase();
        return (
          e.name.toLowerCase().includes(q) ||
          (e.designation?.toLowerCase().includes(q) ?? false)
        );
      })
    : list;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-bold">
            {departmentName}
          </DialogTitle>
          <DialogDescription>
            <span className="scoreboard text-base font-bold text-foreground">
              {list.length}
            </span>{" "}
            {list.length === 1 ? "name" : "names"} in the draw
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search names"
              placeholder="Search names"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          {list.length > 0 ? (
            <Dialog open={clearOpen} onOpenChange={setClearOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="text-destructive"
                    aria-label="Clear all entries"
                    title="Clear all entries"
                  >
                    <Eraser className="size-4" />
                  </Button>
                }
              />
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Clear all entries?</DialogTitle>
                  <DialogDescription>
                    This removes all {list.length} entries from{" "}
                    <span className="font-medium">{departmentName}</span>. This
                    cannot be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setClearOpen(false)}
                    disabled={pending}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={onClearAll} disabled={pending}>
                    {pending && <Loader2 className="size-4 animate-spin" />}
                    Clear all
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {list.length === 0
                ? "No names yet. Use “Add names” to fill this department."
                : "No names match that search."}
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {filtered.map((e) => (
                <li
                  key={e.id}
                  className="flex min-h-12 items-center justify-between gap-2 px-3 py-1.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-1 font-medium">{e.name}</div>
                    {e.designation ? (
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {e.designation}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => openEdit(e)}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Edit ${e.name}`}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onDeleteEntry(e)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${e.name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Dialog
          open={editing !== null}
          onOpenChange={(next) => {
            if (!next) setEditing(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit entry</DialogTitle>
              <DialogDescription>
                Update the name or designation for this entry.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setEditError(null);
                  }}
                  aria-invalid={Boolean(editError)}
                />
                {editError && (
                  <p className="text-xs text-destructive">{editError}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-designation">
                  Designation{" "}
                  <span className="text-xs text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="edit-designation"
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  placeholder="e.g. Coach, Driver, Manager"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={onSaveEdit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
