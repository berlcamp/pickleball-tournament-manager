"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowUpDown,
  Check,
  GripVertical,
  Loader2,
  Shuffle,
  Users,
} from "lucide-react";
import { GroupGenerator } from "@/components/tournament/group-generator";
import { saveSeeding, randomizeSeeding } from "@/actions/seeding";
import { assignParticipantToGroup } from "@/actions/groups";
import { shuffle } from "@/services/seeding";

const UNASSIGNED = "unassigned";

export interface BoardGroup {
  id: string;
  name: string;
  members: { participantId: string; seed: number; name: string }[];
}

export interface BoardTeam {
  id: string;
  name: string;
  groupId: string | null;
}

/** Membership only — reordering locally must not throw the local order away. */
function rosterKey(categoryId: string, teams: BoardTeam[]) {
  return `${categoryId}:${teams
    .map((t) => t.id)
    .sort()
    .join(",")}`;
}

function TeamRow({
  team,
  index,
  options,
  canEdit,
  dragDisabled,
  saving,
  onAssign,
}: {
  team: BoardTeam;
  index: number;
  options: { label: string; value: string }[];
  canEdit: boolean;
  dragDisabled: boolean;
  saving: boolean;
  onAssign: (team: BoardTeam, value: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: team.id, disabled: dragDisabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-xl bg-card/50 px-3 py-2 ${
        isDragging ? "ring-2 ring-primary" : ""
      }`}
    >
      {!dragDisabled && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-5" />
        </button>
      )}
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {team.name}
      </span>
      {canEdit ? (
        <Select
          items={options}
          value={team.groupId ?? UNASSIGNED}
          onValueChange={(v) => onAssign(team, String(v))}
          disabled={saving}
        >
          <SelectTrigger size="sm" className="w-32 shrink-0">
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
          {options.find((o) => o.value === team.groupId)?.label ?? "Unassigned"}
        </span>
      )}
    </li>
  );
}

/**
 * Seeding and group assignment in one board: the Teams column is both the seed
 * order (drag to reorder) and where a team is moved between groups by hand.
 * The automatic-assignment card sits beside the seed controls, so the page is
 * one header row over one pair of columns.
 */
export function SeedingGroupsBoard({
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
  const [order, setOrder] = useState<string[]>(() => teams.map((t) => t.id));
  const [roster, setRoster] = useState(() => rosterKey(categoryId, teams));
  const [shuffling, setShuffling] = useState(false);
  const [pending, startTransition] = useTransition();
  // The row being saved, so only its dropdown is disabled mid-flight.
  const [saving, setSaving] = useState<string | null>(null);
  const [seedState, setSeedState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The seed order saves itself on every drop. Only one write is in flight at
  // a time; a drop during a save is queued so the last order always wins.
  const savingSeeds = useRef(false);
  const queuedSeeds = useRef<string[] | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  // Teams added, removed, or a different category: start from the server order.
  // A plain refresh (after assigning a group) keeps the unsaved local order.
  const nextRoster = rosterKey(categoryId, teams);
  if (nextRoster !== roster) {
    setRoster(nextRoster);
    setOrder(teams.map((t) => t.id));
  }

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const byId = new Map(teams.map((t) => [t.id, t]));
  const rows = order
    .map((id) => byId.get(id))
    .filter((t): t is BoardTeam => Boolean(t));

  const options = [
    { label: "Unassigned", value: UNASSIGNED },
    ...groups.map((g) => ({ label: g.name, value: g.id })),
  ];

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const next = arrayMove(
      order,
      order.indexOf(String(active.id)),
      order.indexOf(String(over.id)),
    );
    setOrder(next);
    void persistSeeds(next);
  }

  async function persistSeeds(next: string[]) {
    if (savingSeeds.current) {
      queuedSeeds.current = next;
      return;
    }
    savingSeeds.current = true;
    setSeedState("saving");
    const res = await saveSeeding(tournamentId, categoryId, next);
    savingSeeds.current = false;
    if (!res.ok) {
      setSeedState("idle");
      queuedSeeds.current = null;
      toast.error(res.error);
      return;
    }
    const queued = queuedSeeds.current;
    queuedSeeds.current = null;
    if (queued) {
      void persistSeeds(queued);
      return;
    }
    setSeedState("saved");
  }

  function randomize() {
    if (shuffling) return;
    setShuffling(true);
    // Animated 5-second visual shuffle.
    intervalRef.current = setInterval(() => {
      setOrder((prev) => shuffle(prev));
    }, 110);

    setTimeout(async () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const res = await randomizeSeeding(tournamentId, categoryId);
      if (res.ok && res.data) {
        setOrder(res.data);
        setSeedState("saved");
        toast.success("Seeds randomized");
      } else if (!res.ok) {
        toast.error(res.error);
      }
      setShuffling(false);
    }, 5000);
  }

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

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass flex flex-col gap-4 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <ArrowUpDown className="size-5" />
              </span>
              <div>
                <h3 className="font-semibold">Seed order</h3>
                <p className="text-sm text-muted-foreground">
                  Drag teams in the list to set seeds — saved as you drop —
                  or shuffle at random.
                </p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-3">
              <Button
                onClick={randomize}
                disabled={shuffling || pending}
                variant="outline"
              >
                <Shuffle className={`size-4 ${shuffling ? "animate-spin" : ""}`} />
                {shuffling ? "Shuffling…" : "Random seed"}
              </Button>
              {seedState === "saving" && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Saving…
                </span>
              )}
              {seedState === "saved" && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Check className="size-3.5 text-primary" /> Saved
                </span>
              )}
            </div>
          </div>
          <GroupGenerator
            tournamentId={tournamentId}
            categoryId={categoryId}
            participantCount={teams.length}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Teams</h3>
            <span className="text-xs text-muted-foreground">
              {rows.length} total
            </span>
          </div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No teams in this category yet.
            </p>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext
                items={order}
                strategy={verticalListSortingStrategy}
              >
                <ul className="space-y-2">
                  {rows.map((team, i) => (
                    <TeamRow
                      key={team.id}
                      team={team}
                      index={i}
                      options={options}
                      canEdit={canEdit}
                      dragDisabled={!canEdit || shuffling}
                      saving={saving === team.id || (pending && saving !== null)}
                      onAssign={assign}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </section>

        <section className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Groups</h3>
          </div>
          {groups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No groups yet — generate them above, then move teams by hand if
              you need to.
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
    </div>
  );
}
