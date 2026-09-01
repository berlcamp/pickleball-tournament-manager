"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addGroup, assignParticipantToGroup } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Users } from "lucide-react";

const UNASSIGNED = "unassigned";

export interface BoardGroup {
  id: string;
  name: string;
  members: { participantId: string; seed: number; name: string }[];
}

export interface BoardTeam {
  id: string;
  name: string;
  seed: number | null;
  groupId: string | null;
}

export function GroupAssignmentBoard({
  tournamentId,
  categoryId,
  teams,
  groups,
  canEdit,
}: {
  tournamentId: string;
  categoryId: string;
  teams: BoardTeam[];
  groups: BoardGroup[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The row being saved, so only its dropdown is disabled mid-flight.
  const [saving, setSaving] = useState<string | null>(null);

  function assign(team: BoardTeam, value: string) {
    const groupId = value === UNASSIGNED ? null : value;
    if (groupId === team.groupId) return;
    setSaving(team.id);
    startTransition(async () => {
      const res = await assignParticipantToGroup(
        tournamentId,
        categoryId,
        team.id,
        groupId,
      );
      setSaving(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const target = groups.find((g) => g.id === groupId);
      toast.success(
        target ? `${team.name} → ${target.name}` : `${team.name} unassigned`,
      );
      router.refresh();
    });
  }

  function add() {
    startTransition(async () => {
      const res = await addGroup(tournamentId, categoryId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  const options = [
    { label: "Unassigned", value: UNASSIGNED },
    ...groups.map((g) => ({ label: g.name, value: g.id })),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="glass rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Teams</h3>
          <span className="text-xs text-muted-foreground">
            {teams.length} total
          </span>
        </div>
        {teams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No teams in this category yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {teams.map((t, i) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-xl bg-card/50 px-3 py-2"
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
                  {t.seed ?? i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {t.name}
                </span>
                {canEdit ? (
                  <Select
                    items={options}
                    value={t.groupId ?? UNASSIGNED}
                    onValueChange={(v) => assign(t, String(v))}
                    disabled={saving === t.id || (pending && saving !== null)}
                  >
                    <SelectTrigger size="sm" className="w-36 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {groups.find((g) => g.id === t.groupId)?.name ??
                      "Unassigned"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass rounded-2xl p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Groups</h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={add} disabled={pending}>
              <Plus className="size-4" /> Add group
            </Button>
          )}
        </div>
        {groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No groups yet — assign them automatically, or add one and place
            teams by hand.
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.id} className="rounded-xl bg-card/50 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-semibold">{g.name}</h4>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="size-3.5" /> {g.members.length}
                  </span>
                </div>
                {g.members.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Empty</p>
                ) : (
                  <ul className="space-y-1.5">
                    {g.members.map((m) => (
                      <li
                        key={m.participantId}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="grid size-5 place-items-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                          {m.seed}
                        </span>
                        <span className="truncate">{m.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
