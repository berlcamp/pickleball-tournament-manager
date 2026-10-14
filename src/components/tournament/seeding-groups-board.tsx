"use client";

import {
  startTransition,
  useEffect,
  useOptimistic,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
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
  Network,
  Shuffle,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
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
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border bg-card py-1.5 pr-2 pl-1.5",
        isDragging && "relative z-10 border-primary shadow-raised ring-2 ring-primary/40",
      )}
    >
      {!dragDisabled && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="grid size-11 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing sm:size-8"
          aria-label={`Drag to reorder ${team.name}, seed ${index + 1}`}
        >
          <GripVertical className="size-5" />
        </button>
      )}
      <span
        className={cn(
          "scoreboard grid size-8 shrink-0 place-items-center rounded-lg bg-court text-lg font-bold text-court-foreground",
          dragDisabled && "ml-1.5",
        )}
        aria-label={`Seed ${index + 1}`}
      >
        {index + 1}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
        {team.name}
      </span>
      {saving && (
        <Loader2
          className="size-4 shrink-0 animate-spin text-muted-foreground"
          aria-label="Saving"
        />
      )}
      {canEdit ? (
        <Select
          items={options}
          value={team.groupId ?? UNASSIGNED}
          onValueChange={(v) => onAssign(team, String(v))}
        >
          <SelectTrigger
            size="sm"
            className="w-28 shrink-0 sm:w-32"
            aria-label={`Group for ${team.name}`}
          >
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
        <span className="shrink-0 font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
  const [order, setOrder] = useState<string[]>(() => teams.map((t) => t.id));
  const [roster, setRoster] = useState(() => rosterKey(categoryId, teams));
  const [shuffling, setShuffling] = useState(false);
  // Group moves picked from a row's dropdown, shown before the server
  // confirms them. Each lives for its save's transition; the revalidated
  // board then carries the real membership (or the old one, on failure).
  const [moves, addMove] = useOptimistic<
    Record<string, string | null>,
    { teamId: string; groupId: string | null }
  >({}, (state, m) => ({ ...state, [m.teamId]: m.groupId }));
  const [seedState, setSeedState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The seed order saves itself on every drop. Only one write is in flight at
  // a time; a drop during a save is queued so the last order always wins.
  const savingSeeds = useRef(false);
  const queuedSeeds = useRef<string[] | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    // Arrow keys reorder too, for anyone not using a mouse or finger.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  const moved = (id: string) => Object.prototype.hasOwnProperty.call(moves, id);
  const byId = new Map(
    teams.map((t) => [t.id, moved(t.id) ? { ...t, groupId: moves[t.id] } : t]),
  );
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
    // A short visual shuffle that runs while the server draws — the save
    // starts at once, the animation just keeps the wait from feeling empty.
    intervalRef.current = setInterval(() => {
      setOrder((prev) => shuffle(prev));
    }, 110);

    const request = randomizeSeeding(tournamentId, categoryId);
    setTimeout(async () => {
      const res = await request;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (res.ok && res.data) {
        setOrder(res.data);
        setSeedState("saved");
        toast.success("Seeds randomized");
      } else if (!res.ok) {
        toast.error(res.error);
      }
      setShuffling(false);
    }, 1200);
  }

  function assign(team: BoardTeam, value: string) {
    const groupId = value === UNASSIGNED ? null : value;
    if (groupId === team.groupId) return;
    startTransition(async () => {
      addMove({ teamId: team.id, groupId });
      const res = await assignParticipantToGroup(
        tournamentId,
        categoryId,
        team.id,
        groupId,
      );
      if (!res.ok) {
        toast.error(`${team.name} wasn't moved. ${res.error ?? ""}`.trim());
      }
    });
  }

  // The Groups column follows the optimistic moves too: a moved team leaves
  // its old group and appears in the new one at once, with its in-group seed
  // shown as pending until the server has worked it out.
  const groupView = groups.map((g) => ({
    ...g,
    members: [
      ...g.members
        .filter((m) => !moved(m.participantId) || moves[m.participantId] === g.id)
        .map((m) => ({ ...m, pending: false })),
      ...teams
        .filter((t) => moved(t.id) && moves[t.id] === g.id && t.groupId !== g.id)
        .map((t) => ({
          participantId: t.id,
          seed: 0,
          name: t.name,
          pending: true,
        })),
    ],
  }));

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="glass flex flex-col gap-4 rounded-2xl p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <ArrowUpDown className="size-5" />
              </span>
              <div>
                <h3 className="font-heading text-xl font-bold leading-tight">
                  1 · Seed order
                </h3>
                <p className="text-sm text-muted-foreground">
                  Drag teams by the handle to rank them — seed 1 is the
                  strongest. Each drop saves on its own. Or shuffle at random.
                </p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-3">
              <Button
                onClick={randomize}
                disabled={shuffling}
                variant="outline"
              >
                <Shuffle className={cn("size-4", shuffling && "animate-spin")} />
                {shuffling ? "Shuffling…" : "Random seed"}
              </Button>
              <span aria-live="polite" className="text-xs text-muted-foreground">
                {seedState === "saving" && (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" /> Saving order…
                  </span>
                )}
                {seedState === "saved" && (
                  <span className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-primary" /> Order saved
                  </span>
                )}
              </span>
            </div>
          </div>
          <GroupGenerator
            tournamentId={tournamentId}
            categoryId={categoryId}
            participantCount={teams.length}
            hasGroups={groups.length > 0}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass rounded-2xl p-4 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-heading text-xl font-bold">Teams by seed</h3>
            <span className="text-xs text-muted-foreground">
              <span className="scoreboard text-base font-bold text-foreground">
                {rows.length}
              </span>{" "}
              {rows.length === 1 ? "team" : "teams"}
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
                <ul className="space-y-1.5">
                  {rows.map((team, i) => (
                    <TeamRow
                      key={team.id}
                      team={team}
                      index={i}
                      options={options}
                      canEdit={canEdit}
                      dragDisabled={!canEdit || shuffling}
                      saving={moved(team.id)}
                      onAssign={assign}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </section>

        <section className="glass rounded-2xl p-4 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-heading text-xl font-bold">Groups</h3>
            {groups.length > 0 && (
              <span className="text-xs text-muted-foreground">
                <span className="scoreboard text-base font-bold text-foreground">
                  {groups.length}
                </span>{" "}
                {groups.length === 1 ? "group" : "groups"}
              </span>
            )}
          </div>
          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-10 text-center">
              <Network className="size-6 text-primary" />
              <p className="font-medium">No groups yet</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                {canEdit
                  ? "Set the seed order, then use “Draw groups” above. You can move teams between groups by hand afterwards."
                  : "The organiser hasn't drawn the groups yet."}
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {groupView.map((g) => (
                <div
                  key={g.id}
                  className="overflow-hidden rounded-xl border border-border bg-card"
                >
                  <div className="flex items-center justify-between bg-court px-3 py-2 text-court-foreground">
                    <h4 className="font-heading text-base font-bold uppercase tracking-wide">
                      {g.name}
                    </h4>
                    <span className="flex items-center gap-1 text-xs text-court-foreground/75">
                      <Users className="size-3.5" />
                      <span className="scoreboard text-sm font-semibold">
                        {g.members.length}
                      </span>
                    </span>
                  </div>
                  {g.members.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-muted-foreground">
                      Empty — pick this group from a team&apos;s dropdown.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {g.members.map((m) => (
                        <li
                          key={m.participantId}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 text-sm",
                            m.pending && "text-muted-foreground",
                          )}
                        >
                          <span className="scoreboard grid size-6 shrink-0 place-items-center rounded-md bg-muted text-sm font-bold text-muted-foreground">
                            {m.pending ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              m.seed
                            )}
                          </span>
                          <span className="truncate font-medium">{m.name}</span>
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
