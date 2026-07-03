"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addParticipant,
  bulkAddParticipants,
  deleteParticipant,
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
import { Plus, Trash2, Upload } from "lucide-react";
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
          <ul className="divide-y divide-white/5">
            {participants.map((p, i) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-3 py-2.5"
              >
                <div className="flex items-center gap-3">
                  <span className="grid size-7 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="font-medium">{p.name}</span>
                </div>
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() =>
                      startTransition(async () => {
                        const res = await deleteParticipant(tournamentId, p.id);
                        if (!res.ok) toast.error(res.error);
                      })
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
