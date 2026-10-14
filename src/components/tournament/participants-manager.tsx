"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addParticipant,
  bulkAddParticipants,
  clearParticipants,
  deleteParticipant,
  importApprovedRegistrations,
  renameParticipant,
} from "@/actions/participants";
import { EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Check,
  ClipboardCheck,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { BlindPairingDialog } from "./blind-pairing-dialog";
import type { Participant } from "@/types";

/** A team as listed: just what the row needs, plus an in-flight marker. */
type ShownTeam = Pick<Participant, "id" | "name"> & { saving?: boolean };
type TeamOp =
  | { type: "add"; id: string; name: string }
  | { type: "rename"; id: string; name: string }
  | { type: "remove"; id: string };

export function ParticipantsManager({
  tournamentId,
  categoryId,
  participants,
  importableCount,
  blindPairing,
  unpairedPlayers,
  canEdit,
  canRename,
}: {
  tournamentId: string;
  categoryId: string;
  participants: Participant[];
  /** Approved registrations with no team in this category yet. */
  importableCount: number;
  /** Players register alone and are drawn into teams with Blind pairing. */
  blindPairing: boolean;
  /** Blind pairing only: approved registrants not yet in a team. */
  unpairedPlayers: string[];
  /** Admin on a category still in draft: the list itself can be changed. */
  canEdit: boolean;
  /** Admin, at any stage — a typo is fixable once the stage has started. */
  canRename: boolean;
}) {
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importing, startImport] = useTransition();
  const [bulkAdding, startBulk] = useTransition();
  const [, startRowAction] = useTransition();

  // Adds, renames and removals land in the list straight away. The page's
  // revalidated props replace this once each action returns, and a failure
  // falls back to them, so errors only need a toast.
  const [teams, applyTeam] = useOptimistic(
    participants as ShownTeam[],
    (list, op: TeamOp) => {
      if (op.type === "add")
        return [...list, { id: op.id, name: op.name, saving: true }];
      if (op.type === "remove") return list.filter((t) => t.id !== op.id);
      return list.map((t) =>
        t.id === op.id ? { ...t, name: op.name, saving: true } : t,
      );
    },
  );

  function add() {
    const team = name.trim();
    if (!team) return;
    setName("");
    startRowAction(async () => {
      applyTeam({ type: "add", id: `new-${Date.now()}`, name: team });
      const res = await addParticipant(tournamentId, categoryId, team);
      if (!res.ok) {
        toast.error(`Couldn't add ${team}: ${res.error}`);
        // Give the name back so it isn't lost to a failed save.
        setName((current) => current || team);
      }
    });
  }

  function rename(id: string, next: string) {
    startRowAction(async () => {
      applyTeam({ type: "rename", id, name: next });
      const res = await renameParticipant(tournamentId, id, next);
      if (!res.ok) toast.error(`Couldn't rename the team: ${res.error}`);
    });
  }

  function remove(team: ShownTeam) {
    startRowAction(async () => {
      applyTeam({ type: "remove", id: team.id });
      const res = await deleteParticipant(tournamentId, team.id);
      if (!res.ok) toast.error(`Couldn't remove ${team.name}: ${res.error}`);
    });
  }

  function addFromRegistrations() {
    startImport(async () => {
      const res = await importApprovedRegistrations(tournamentId, categoryId);
      if (!res.ok) { toast.error(res.error); return; }
      const { imported, linked } = res.data!;
      toast.success(
        linked > 0
          ? `${imported} teams added · ${linked} matched a team already here`
          : `${imported} teams added from approved registrations`,
      );
    });
  }

  function bulkAdd() {
    startBulk(async () => {
      const res = await bulkAddParticipants(tournamentId, categoryId, bulk);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${res.data} teams added`);
      setBulk("");
      setBulkOpen(false);
    });
  }

  const bulkCount = bulk.split("\n").filter((l) => l.trim()).length;

  return (
    <div className="space-y-4">
      {canEdit ? (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
          <form
            className="space-y-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Label htmlFor="new-team">Add a team</Label>
            <div className="flex gap-2">
              <Input
                id="new-team"
                placeholder="e.g. Cesar / Honey"
                autoComplete="off"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={!name.trim()}
                variant={blindPairing ? "outline" : "default"}
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Add team</span>
                <span className="sm:hidden">Add</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter to add. Write both players&apos; names, split by a
              slash.
            </p>
          </form>

          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            {/* Approving a registration no longer adds its team on its own —
                the organiser decides when they come across. */}
            {/* In a blind pairing category a registration is one player, not a
                team — those go through the draw below instead. */}
            {!blindPairing && (
              <Button
                variant="outline"
                onClick={addFromRegistrations}
                disabled={importing || importableCount === 0}
                title={
                  importableCount === 0
                    ? "Every approved registration is already in this list"
                    : `Add ${importableCount} approved ${importableCount === 1 ? "registration" : "registrations"} to the team list`
                }
                className={cn(
                  importableCount > 0 &&
                    "border-primary/40 bg-primary/8 text-primary hover:bg-primary/12 hover:text-primary",
                )}
              >
                {importing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="size-4" />
                )}
                Add from Registrations
                {importableCount > 0 && (
                  <span className="scoreboard rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                    {importableCount}
                  </span>
                )}
              </Button>
            )}
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger render={<Button variant="outline" />}>
                <Upload className="size-4" /> Paste a list
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading text-2xl font-bold">
                    Paste a list of teams
                  </DialogTitle>
                  <DialogDescription>
                    One team per line — straight from a spreadsheet or chat
                    works fine. Blank lines are skipped.
                  </DialogDescription>
                </DialogHeader>
                <Textarea
                  rows={8}
                  aria-label="Teams, one per line"
                  className="field-sizing-fixed h-40 resize-none overflow-y-auto"
                  placeholder={"Cesar / Honey\nHizen / Tonix\nRiezalday / Alyza"}
                  value={bulk}
                  onChange={(e) => setBulk(e.target.value)}
                />
                <DialogFooter>
                  <Button
                    onClick={bulkAdd}
                    disabled={bulkAdding || bulkCount === 0}
                  >
                    {bulkAdding && <Loader2 className="size-4 animate-spin" />}
                    {bulkAdding
                      ? "Adding…"
                      : bulkCount > 0
                        ? `Add ${bulkCount} ${bulkCount === 1 ? "team" : "teams"}`
                        : "Add teams"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <BlindPairingDialog
              tournamentId={tournamentId}
              categoryId={categoryId}
              registrants={blindPairing ? unpairedPlayers : undefined}
              primary={blindPairing}
            />
            {participants.length > 0 && (
              <ClearTeamsButton
                tournamentId={tournamentId}
                categoryId={categoryId}
                count={participants.length}
              />
            )}
          </div>
        </div>
      ) : (
        canRename && (
          <p className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            <Lock className="size-4 shrink-0" />
            This category has started, so teams can&apos;t be added or
            removed. You can still fix a name with the pencil.
          </p>
        )
      )}

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No teams yet"
          description={
            canEdit
              ? blindPairing
                ? "Use Blind pairing to draw partners for the registered players."
                : "Type a team above, paste a list, or bring in approved registrations."
              : "Teams added by the organiser will show up here."
          }
        />
      ) : (
        <section className="rounded-2xl border border-border bg-card shadow-card">
          <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
            <h2 className="font-heading text-xl font-bold">Team list</h2>
            <span className="scoreboard text-lg font-bold text-muted-foreground">
              {teams.length}
            </span>
          </div>
          <ul className="divide-y divide-border">
            {teams.map((p, i) => (
              <TeamRow
                key={p.id}
                team={p}
                index={i}
                canEdit={canEdit && !p.saving}
                canRename={canRename && !p.saving}
                onRename={(next) => rename(p.id, next)}
                onRemove={() => remove(p)}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Wipe the whole list in one go — a mis-imported bulk paste is otherwise
 * removed one row at a time. Confirmed in a dialog because it can't be undone.
 */
function ClearTeamsButton({
  tournamentId,
  categoryId,
  count,
}: {
  tournamentId: string;
  categoryId: string;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function clear() {
    startTransition(async () => {
      const res = await clearParticipants(tournamentId, categoryId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.data} teams removed`);
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            className="text-muted-foreground hover:text-destructive sm:ml-auto"
          />
        }
      >
        <Trash2 className="size-4" /> Clear all
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Clear all teams?</DialogTitle>
          <DialogDescription>
            This removes all {count} teams in this category, along with their
            seeding and any groups and schedule drawn from them. Approved
            registrations stay approved — bring those teams back with
            &ldquo;Add from Registrations&rdquo;. This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button variant="destructive" onClick={clear} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Clearing…" : "Clear all teams"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One team in the list. Removing it is draft-only — groups and matches are
 * drawn from the list — but the name stays editable in place afterwards, so a
 * typo doesn't follow the team through the brackets and the public portal.
 */
function TeamRow({
  team,
  index,
  canEdit,
  canRename,
  onRename,
  onRemove,
}: {
  team: ShownTeam;
  index: number;
  canEdit: boolean;
  canRename: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(team.name);

  function startEditing() {
    setDraft(team.name);
    setEditing(true);
  }

  function save() {
    const name = draft.trim();
    setEditing(false);
    if (!name || name === team.name) return;
    onRename(name);
  }

  return (
    <li
      className={cn(
        "flex min-h-14 items-center justify-between gap-2 px-4 py-2",
        team.saving && "text-muted-foreground",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="scoreboard grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-base font-bold text-muted-foreground">
          {index + 1}
        </span>
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            // Clicking away is a save, matching how the name reads as a field.
            onBlur={save}
            className="flex-1"
            aria-label={`Rename ${team.name}`}
          />
        ) : (
          <span className="truncate font-medium">{team.name}</span>
        )}
        {team.saving && (
          <Loader2
            className="size-4 shrink-0 animate-spin"
            aria-label="Saving"
          />
        )}
      </div>

      {(canEdit || canRename) && (
        <div className="flex shrink-0 items-center gap-1">
          {editing ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                // The input's blur already saves; this is the explicit tap.
                onMouseDown={(e) => e.preventDefault()}
                onClick={save}
                aria-label="Save name"
                className="text-primary"
              >
                <Check className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEditing(false)}
                aria-label="Cancel"
              >
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <>
              {canRename && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={startEditing}
                  aria-label={`Rename ${team.name}`}
                  className="text-muted-foreground"
                >
                  <Pencil className="size-4" />
                </Button>
              )}
              {canEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onRemove}
                  aria-label={`Remove ${team.name}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
