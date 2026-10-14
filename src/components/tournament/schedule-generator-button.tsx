"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScheduleGenerator } from "@/components/tournament/schedule-generator";
import { CalendarClock, Lock } from "lucide-react";
import type { Category } from "@/types";

/**
 * The schedule generator, reachable from the tournament header on every tab —
 * it replaced the Schedule tab as the way in. The active category comes from
 * `?category=`, the same source the tabs and the category switcher read, since
 * layouts don't receive searchParams.
 */
export function ScheduleGeneratorButton({
  tournamentId,
  categories,
  groupsByCategory,
}: {
  tournamentId: string;
  categories: Category[];
  /** Each category's groups in board order, for the optional group filter. */
  groupsByCategory: Record<string, { id: string; name: string }[]>;
}) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  if (categories.length === 0) return null;

  const requested = searchParams.get("category");
  const active = categories.find((c) => c.id === requested) ?? categories[0];
  // Times and courts are locked once the stage starts, same as the tab was.
  const locked = active.status !== "draft";

  return (
    <>
      {/* Sits on the court-green workspace hero, so it wears the ball color
          as that header's one primary action. */}
      <Button
        size="sm"
        className="bg-ball text-ball-foreground shadow-none hover:bg-[color-mix(in_oklch,var(--ball),black_8%)]"
        onClick={() => setOpen(true)}
        // Not `disabled` when locked: a disabled button can't say why on a
        // phone (no hover title), so it opens and explains instead.
        aria-label={locked ? `Schedule Generator (locked for ${active.name})` : undefined}
      >
        {locked ? <Lock className="size-4" /> : <CalendarClock className="size-4" />}
        Schedule Generator
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-bold">
              Schedule generator
            </DialogTitle>
            <DialogDescription className={locked ? undefined : "sr-only"}>
              {locked
                ? `${active.name} has already started, so its match times and courts are locked — players are going by them. To change the schedule, reopen the group stage from the Group Stage tab (possible until the first score is entered).`
                : "Build the match times and court assignments for this category."}
            </DialogDescription>
          </DialogHeader>
          {locked ? (
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Got it
              </Button>
            </div>
          ) : (
          <ScheduleGenerator
            key={active.id}
            embedded
            onGenerated={() => setOpen(false)}
            tournamentId={tournamentId}
            categoryId={active.id}
            categoryName={active.name}
            settings={active.settings}
            eventDate={active.event_date}
            groups={groupsByCategory[active.id] ?? []}
            draftCategories={categories
              .filter((c) => c.status === "draft")
              .map((c) => ({ id: c.id, name: c.name }))}
          />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
