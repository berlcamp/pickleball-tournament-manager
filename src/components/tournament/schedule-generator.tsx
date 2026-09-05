"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { generateSchedule } from "@/actions/schedule";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MATCH_INTERVALS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/format";
import type { CategorySettings, KnockoutRounds, ScheduleMode } from "@/types";
import { CalendarClock, HelpCircle } from "lucide-react";

type Scope = "category" | "tournament";

export function ScheduleGenerator({
  tournamentId,
  categoryId,
  categoryName,
  settings,
  eventDate: categoryDate,
  groups,
  draftCategories,
  embedded = false,
  onGenerated,
}: {
  tournamentId: string;
  categoryId: string;
  categoryName: string;
  settings: CategorySettings;
  /** The category's play date (its own column), shared with the settings page. */
  eventDate: string | null;
  /** This category's groups, in board order, for the optional group filter. */
  groups: { id: string; name: string }[];
  /** Every category still in draft — what a tournament-wide run would rebuild. */
  draftCategories: { id: string; name: string }[];
  /** Inside a dialog: the surrounding card and its heading come from the host. */
  embedded?: boolean;
  /** Called once a run has been written, so a host dialog can close itself. */
  onGenerated?: () => void;
}) {
  const [venue, setVenue] = useState(settings.venue_name ?? "");
  const [eventDate, setEventDate] = useState(categoryDate ?? "");
  const [startTime, setStartTime] = useState(settings.start_time ?? "08:00");
  const [interval, setIntervalV] = useState(settings.match_interval ?? 15);
  const [numCourts, setNumCourts] = useState(settings.num_courts ?? 4);
  const [mode, setMode] = useState<ScheduleMode>(
    settings.schedule_mode ?? "sequential",
  );
  const [knockout, setKnockout] = useState<KnockoutRounds>(
    settings.knockout_rounds ?? "none",
  );
  // Empty = every group. Groups play on different days, so a run can be
  // narrowed to the ones sharing the date above.
  const [groupIds, setGroupIds] = useState<string[]>([]);
  // How far the run reaches: this category, or every category still in draft.
  const [scope, setScope] = useState<Scope>("category");
  const [confirmAll, setConfirmAll] = useState(false);
  const [pending, startTransition] = useTransition();

  const wholeTournament = scope === "tournament";
  // The group filter only applies to a single-category run.
  const allGroups = groupIds.length === 0 || wholeTournament;
  const otherCount = Math.max(0, draftCategories.length - 1);

  function toggleGroup(id: string) {
    setGroupIds((current) =>
      current.includes(id)
        ? current.filter((g) => g !== id)
        : [...current, id],
    );
  }

  function generate() {
    startTransition(async () => {
      const res = await generateSchedule(tournamentId, categoryId, {
        venue_name: venue.trim() || undefined,
        event_date: eventDate || undefined,
        start_time: startTime,
        // No target end time — schedule across a full-day window.
        end_time: "23:59",
        match_interval: interval,
        num_courts: numCourts,
        schedule_mode: mode,
        knockout_rounds: knockout,
        scope,
        group_ids: wholeTournament ? [] : groupIds,
      });
      if (!res.ok) { toast.error(res.error); return; }
      setConfirmAll(false);
      onGenerated?.();
      const d = res.data!;
      const koNote = d.knockoutReserved
        ? ` + ${d.knockoutReserved} knockout slots reserved`
        : "";
      const where = wholeTournament
        ? ` across ${d.categories.length} ${d.categories.length === 1 ? "category" : "categories"}`
        : allGroups
          ? ""
          : ` in ${groupIds.length} ${groupIds.length === 1 ? "group" : "groups"}`;
      const skippedNote = d.skipped.length
        ? ` Skipped ${d.skipped.join(", ")} — no groups or matches yet.`
        : "";
      if (d.feasible) {
        toast.success(
          `Scheduled ${d.scheduled} matches${where}${koNote} (ends ~${formatTime(d.projectedEnd)}).${skippedNote}`,
        );
      } else {
        toast.warning(
          `Scheduled ${d.scheduled}, but ${d.unscheduled} couldn't fit. Add courts or extend the window.${skippedNote}`,
        );
      }
    });
  }

  return (
    <div className={cn("space-y-4", !embedded && "glass rounded-2xl p-5")}>
      {/* In a dialog the title comes from the host, but the blurb stays: it
          tracks the scope toggle and says what the run will actually rebuild. */}
      <div className="flex items-center gap-3">
        {!embedded && (
          <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
            <CalendarClock className="size-5" />
          </span>
        )}
        <div>
          {!embedded && <h3 className="font-semibold">Smart scheduling engine</h3>}
          <p className="text-sm text-muted-foreground">
            {wholeTournament ? (
              <>
                Builds the schedule for <strong>every category</strong> still in
                draft — each one laid out after the last on the shared courts,
                so no court is double-booked.
              </>
            ) : (
              <>
                Builds the schedule for <strong>{categoryName}</strong> —
                spreading its matches across the shared courts back to back.
              </>
            )}
          </p>
        </div>
      </div>

      {draftCategories.length > 1 && (
        <Field
          label="Apply to"
          hint="This category schedules on its own, exactly as before. All categories rebuilds every category still in draft in one run, laying each out around the slots the earlier ones took — categories that have already started keep their locked times."
        >
          <div className="flex flex-wrap gap-2">
            <GroupChip
              selected={!wholeTournament}
              onClick={() => setScope("category")}
            >
              This category
            </GroupChip>
            <GroupChip
              selected={wholeTournament}
              onClick={() => setScope("tournament")}
            >
              All categories ({draftCategories.length})
            </GroupChip>
          </div>
          <p className="text-xs text-muted-foreground">
            {wholeTournament
              ? `${categoryName} and ${otherCount} other ${otherCount === 1 ? "category" : "categories"} are rebuilt together, one after another on the same courts.`
              : "Only this category is rebuilt; every other category keeps its schedule."}
          </p>
        </Field>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label="Venue name"
          hint="Where this category's matches are played. Shown alongside the published schedule."
        >
          <Input
            type="text"
            placeholder="e.g. City Sports Complex"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
          />
        </Field>
        <Field
          label="Date"
          hint={
            wholeTournament
              ? "Fills in the play date of categories that don't have one yet. A category that already has its own date keeps it, and is scheduled on that day."
              : "The calendar day this category is played. Shown on the public page and alongside the published schedule."
          }
        >
          <Input
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </Field>
        <Field
          label="Start time"
          hint="When this category's first match begins. Its matches are laid out from this time onward."
        >
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </Field>
        <Field
          label="Match interval"
          hint="How long each match slot lasts. A court's next match starts this many minutes after the previous one began."
        >
          <Select
            items={MATCH_INTERVALS.map((m) => ({
              label: `${m} minutes`,
              value: String(m),
            }))}
            value={String(interval)}
            onValueChange={(v) => setIntervalV(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATCH_INTERVALS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} minutes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Number of courts"
          hint={
            wholeTournament
              ? "How many courts run at the same time. Courts are shared venue-wide, and a tournament-wide run spreads every category over them without double-booking."
              : "How many courts run at the same time for this category. Courts are shared venue-wide, so coordinate start times across categories to avoid double-booking a court."
          }
        >
          <Input
            type="number"
            min={1}
            max={20}
            value={numCourts}
            onChange={(e) => setNumCourts(Number(e.target.value))}
          />
        </Field>
        <Field
          label="Scheduling mode"
          hint="Equally Distributed spreads each group's matches evenly across the day. Sequential by Group plays one group's matches through before moving to the next."
        >
          <Select
            items={[
              { label: "Sequential by Group (recommended)", value: "sequential" },
              { label: "Equally Distributed", value: "distributed" },
            ]}
            value={mode}
            onValueChange={(v) => setMode(v as ScheduleMode)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sequential">
                Sequential by Group (recommended)
              </SelectItem>
              <SelectItem value="distributed">Equally Distributed</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Knockout rounds"
          hint="Reserve placeholder slots after the group stage for this category's knockout bracket, so the timeline already accounts for them. Choose how far to reserve: up to semifinals, or all the way to finals."
        >
          <Select
            items={[
              { label: "None", value: "none" },
              { label: "Up to semifinals", value: "semifinals" },
              { label: "Up to finals", value: "finals" },
            ]}
            value={knockout}
            onValueChange={(v) => setKnockout(v as KnockoutRounds)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="semifinals">Up to semifinals</SelectItem>
              <SelectItem value="finals">Up to finals</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      {groups.length > 1 && !wholeTournament && (
        <Field
          label="Groups"
          hint="Which groups this run schedules. Groups can be played on different days, so pick the ones sharing the date above and generate them together — every other group keeps the times and courts it already has."
        >
          <div className="flex flex-wrap gap-2">
            <GroupChip
              selected={allGroups}
              onClick={() => setGroupIds([])}
            >
              All groups
            </GroupChip>
            {groups.map((g) => (
              <GroupChip
                key={g.id}
                selected={groupIds.includes(g.id)}
                onClick={() => toggleGroup(g.id)}
              >
                {g.name}
              </GroupChip>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {allGroups
              ? "Every group is rebuilt on the date above."
              : "Only the selected groups are rebuilt; the rest keep their current schedule."}
          </p>
        </Field>
      )}

      <Button
        onClick={() => (wholeTournament ? setConfirmAll(true) : generate())}
        disabled={pending}
      >
        {pending
          ? "Building schedule…"
          : wholeTournament
            ? "Generate all categories"
            : allGroups
              ? "Generate schedule"
              : `Generate ${groupIds.length} ${groupIds.length === 1 ? "group" : "groups"}`}
      </Button>

      {/* A tournament-wide run replaces schedules the organiser can't see from
          this tab, so it asks first and names what it will rebuild. */}
      <Dialog open={confirmAll} onOpenChange={setConfirmAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rebuild every category&apos;s schedule?</DialogTitle>
            <DialogDescription>
              This replaces the match times and courts of{" "}
              {draftCategories.map((c) => c.name).join(", ")}. Each category is
              laid out after the last on the same courts. Categories that have
              already started keep their locked schedule.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={generate} disabled={pending}>
              {pending ? "Building schedule…" : "Generate all categories"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Toggle chip for the optional group filter. */
function GroupChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label>{label}</Label>
        {hint && <HelpHint title={label}>{hint}</HelpHint>}
      </div>
      {children}
    </div>
  );
}

function HelpHint({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        type="button"
        aria-label={`What is "${title}" for?`}
        className="text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
      >
        <HelpCircle className="size-3.5" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner
          side="top"
          sideOffset={6}
          className="isolate z-50"
        >
          <PopoverPrimitive.Popup className="z-50 max-w-xs origin-(--transform-origin) rounded-lg bg-popover p-3 text-popover-foreground shadow-md ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <PopoverPrimitive.Title className="mb-1 text-xs font-semibold">
              {title}
            </PopoverPrimitive.Title>
            <PopoverPrimitive.Description className="text-xs text-muted-foreground">
              {children}
            </PopoverPrimitive.Description>
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
