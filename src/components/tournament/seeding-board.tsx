"use client";

import { useEffect, useRef, useState, useTransition } from "react";
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
import { GripVertical, Save, Shuffle } from "lucide-react";
import { saveSeeding, randomizeSeeding } from "@/actions/seeding";
import { shuffle } from "@/services/seeding";
import type { Participant } from "@/types";

interface Item {
  id: string;
  name: string;
}

function SortableRow({
  item,
  index,
  disabled,
}: {
  item: Item;
  index: number;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-3 rounded-xl bg-card/50 px-3 py-2.5 ${
        isDragging ? "ring-2 ring-primary" : ""
      }`}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
        {index + 1}
      </span>
      <span className="flex-1 font-medium">{item.name}</span>
      {!disabled && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab text-muted-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-5" />
        </button>
      )}
    </li>
  );
}

export function SeedingBoard({
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
  const [items, setItems] = useState<Item[]>(
    participants.map((p) => ({ id: p.id, name: p.name })),
  );
  const [shuffling, setShuffling] = useState(false);
  const [pending, startTransition] = useTransition();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor));

  // Re-sync the local list when the active category (and thus the
  // participants) changes — otherwise switching category keeps the old seeds.
  useEffect(() => {
    setItems(participants.map((p) => ({ id: p.id, name: p.name })));
  }, [categoryId, participants]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((i) => i.id === active.id);
      const newIndex = prev.findIndex((i) => i.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function save() {
    startTransition(async () => {
      const res = await saveSeeding(
        tournamentId,
        categoryId,
        items.map((i) => i.id),
      );
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Seeding saved");
    });
  }

  function randomize() {
    if (shuffling) return;
    setShuffling(true);
    // Animated 3-second visual shuffle.
    intervalRef.current = setInterval(() => {
      setItems((prev) => shuffle(prev));
    }, 110);

    setTimeout(async () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      const res = await randomizeSeeding(tournamentId, categoryId);
      if (res.ok && res.data) {
        const byId = new Map(items.map((i) => [i.id, i]));
        setItems(res.data.map((id) => byId.get(id)!).filter(Boolean));
        toast.success("Seeds randomized");
      } else if (!res.ok) {
        toast.error(res.error);
      }
      setShuffling(false);
    }, 3000);
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button onClick={randomize} disabled={shuffling || pending} variant="outline">
            <Shuffle className={`size-4 ${shuffling ? "animate-spin" : ""}`} />
            {shuffling ? "Shuffling…" : "Random seed"}
          </Button>
          <Button onClick={save} disabled={shuffling || pending}>
            <Save className="size-4" /> Save order
          </Button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="glass space-y-2 rounded-2xl p-3">
            {items.map((item, i) => (
              <SortableRow
                key={item.id}
                item={item}
                index={i}
                disabled={!canEdit || shuffling}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}
