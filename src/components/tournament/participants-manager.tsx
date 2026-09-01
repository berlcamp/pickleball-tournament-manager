"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addParticipant,
  bulkAddParticipants,
  deleteParticipant,
  renameParticipant,
} from "@/actions/participants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Check, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import type { Participant } from "@/types";

export function ParticipantsManager({
  tournamentId,
  categoryId,
  participants,
  canEdit,
}: {
  tournamentId: string;
  categoryId: string;
  participants: Participant[];
  canEdit: boolean;
}) {
  const [name, setName] = useState("");
  const [bulk, setBulk] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await addParticipant(tournamentId, categoryId, name.trim());
      if (!res.ok) { toast.error(res.error); return; }
      setName("");
      toast.success("Team added");
    });
  }

  function importBulk() {
    startTransition(async () => {
      const res = await bulkAddParticipants(tournamentId, categoryId, bulk);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${res.data} teams imported`);
      setBulk("");
      setBulkOpen(false);
    });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="glass flex flex-col gap-2 rounded-2xl p-4 sm:flex-row">
          <Input
            placeholder="Team name (e.g. Cesar / Honey)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className="flex-1"
          />
          <Button onClick={add} disabled={pending}>
            <Plus className="size-4" /> Add team
          </Button>
          <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
            <DialogTrigger render={<Button variant="outline" />}>
              <Upload className="size-4" /> Bulk import
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Bulk import teams</DialogTitle>
                <DialogDescription>
                  One team per line.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                rows={8}
                className="field-sizing-fixed h-40 resize-none overflow-y-auto"
                placeholder={"Cesar / Honey\nHizen / Tonix\nRiezalday / Alyza"}
                value={bulk}
                onChange={(e) => setBulk(e.target.value)}
              />
              <DialogFooter>
                <Button onClick={importBulk} disabled={pending || !bulk.trim()}>
                  Import teams
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      <div className="glass rounded-2xl p-2">
        {participants.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            No teams yet. Add your first team above.
          </p>
        ) : (
          <ul className="divide-y divide-border/50">
            {participants.map((p, i) => (
              <TeamRow
                key={p.id}
                tournamentId={tournamentId}
                participant={p}
                index={i}
                canEdit={canEdit}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * One team in the list. The name is editable in place while the category is
 * still a draft — a typo in a team name would otherwise be stuck there once the
 * group stage locks the list.
 */
function TeamRow({
  tournamentId,
  participant,
  index,
  canEdit,
}: {
  tournamentId: string;
  participant: Participant;
  index: number;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(participant.name);
  const [pending, startTransition] = useTransition();

  function startEditing() {
    setDraft(participant.name);
    setEditing(true);
  }

  function save() {
    const name = draft.trim();
    if (!name || name === participant.name) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await renameParticipant(tournamentId, participant.id, name);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setEditing(false);
      toast.success("Team renamed");
    });
  }

  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
          {index + 1}
        </span>
        {editing ? (
          <Input
            autoFocus
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") setEditing(false);
            }}
            // Clicking away is a save, matching how the name reads as a field.
            onBlur={save}
            className="h-8 flex-1"
            aria-label={`Rename ${participant.name}`}
          />
        ) : (
          <span className="truncate font-medium">{participant.name}</span>
        )}
      </div>

      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          {editing ? (
            <>
              <Button
                size="icon"
                variant="ghost"
                disabled={pending}
                // The input's blur already saves; this is the explicit tap.
                onMouseDown={(e) => e.preventDefault()}
                onClick={save}
                title="Save name"
              >
                <Check className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={pending}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setEditing(false)}
                title="Cancel"
              >
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                size="icon"
                variant="ghost"
                onClick={startEditing}
                title="Rename team"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await deleteParticipant(
                      tournamentId,
                      participant.id,
                    );
                    if (!res.ok) toast.error(res.error);
                  })
                }
                title="Remove team"
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  );
}
