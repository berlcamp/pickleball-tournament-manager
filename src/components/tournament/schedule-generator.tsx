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
import { MATCH_INTERVALS } from "@/lib/constants";
import { formatTime } from "@/lib/format";
import type { CategorySettings, KnockoutRounds, ScheduleMode } from "@/types";
import { CalendarClock, HelpCircle } from "lucide-react";

export function ScheduleGenerator({
  tournamentId,
  categoryId,
  categoryName,
  settings,
}: {
  tournamentId: string;
  categoryId: string;
  categoryName: string;
  settings: CategorySettings;
}) {
  const [startTime, setStartTime] = useState(settings.start_time ?? "08:00");
  const [endTime, setEndTime] = useState(settings.end_time ?? "17:00");
  const [interval, setIntervalV] = useState(settings.match_interval ?? 15);
  const [numCourts, setNumCourts] = useState(settings.num_courts ?? 4);
  const [rest, setRest] = useState(settings.rest_period ?? 0);
  const [mode, setMode] = useState<ScheduleMode>(
    settings.schedule_mode ?? "distributed",
  );
  const [knockout, setKnockout] = useState<KnockoutRounds>(
    settings.knockout_rounds ?? "none",
  );
  const [pending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const res = await generateSchedule(tournamentId, categoryId, {
        start_time: startTime,
        end_time: endTime,
        match_interval: interval,
        num_courts: numCourts,
        rest_period: rest,
        schedule_mode: mode,
        knockout_rounds: knockout,
      });
      if (!res.ok) { toast.error(res.error); return; }
      const d = res.data!;
      const koNote = d.knockoutReserved
        ? ` + ${d.knockoutReserved} knockout slots reserved`
        : "";
      if (d.feasible) {
        toast.success(
          `Scheduled ${d.scheduled} matches${koNote} (ends ~${formatTime(d.projectedEnd)})`,
        );
      } else {
        toast.warning(
          `Scheduled ${d.scheduled}, but ${d.unscheduled} couldn't fit. Add courts or extend the window.`,
        );
      }
    });
  }

  return (
    <div className="glass space-y-4 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
          <CalendarClock className="size-5" />
        </span>
        <div>
          <h3 className="font-semibold">Smart scheduling engine</h3>
          <p className="text-sm text-muted-foreground">
            Builds the schedule for <strong>{categoryName}</strong> — spreading
            its matches across the shared courts with rest periods and conflict
            detection.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
          label="Target end time"
          hint="The time you'd like all group-stage matches finished by. If they can't all fit before this, the engine warns you to add courts or extend the window."
        >
          <Input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </Field>
        <Field
          label="Match interval"
          hint="How long each match slot lasts. A court's next match starts this many minutes after the previous one began."
        >
          <Select
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
          hint="How many courts run at the same time for this category. Courts are shared venue-wide, so coordinate start times across categories to avoid double-booking a court."
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
          label="Rest period (min)"
          hint="Minimum minutes a team rests between its own matches, so the same team is never scheduled back-to-back. Set to 0 for no rest requirement."
        >
          <Input
            type="number"
            min={0}
            max={180}
            value={rest}
            onChange={(e) => setRest(Number(e.target.value))}
          />
        </Field>
        <Field
          label="Scheduling mode"
          hint="Equally Distributed spreads each group's matches evenly across the day. Sequential by Group plays one group's matches through before moving to the next."
        >
          <Select value={mode} onValueChange={(v) => setMode(v as ScheduleMode)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="distributed">
                Equally Distributed (recommended)
              </SelectItem>
              <SelectItem value="sequential">Sequential by Group</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Knockout rounds"
          hint="Reserve placeholder slots after the group stage for this category's knockout bracket, so the timeline already accounts for them. Choose how far to reserve: up to semifinals, or all the way to finals."
        >
          <Select
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

      <Button onClick={generate} disabled={pending}>
        {pending ? "Building schedule…" : "Generate schedule"}
      </Button>
    </div>
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
