"use client";

import { useMemo, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MatchStatusBadge } from "@/components/status-badge";
import { toggleQueued } from "@/actions/schedule";
import { formatDate, formatTime, timeToMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Loader2, Search, Trophy } from "lucide-react";

export interface ScheduleRow {
  id: string;
  time: string | null;
  /** Calendar date the match falls on, ISO "YYYY-MM-DD". */
  date?: string | null;
  court: string;
  team1: string;
  team2: string;
  group: string;
  /** Owning category name, when the schedule spans multiple categories. */
  category?: string | null;
  /** Venue where this category's matches are played, if configured. */
  venue?: string | null;
  status: "pending" | "in_progress" | "completed";
  /** Staff-set flag: this match is queued / called to the court next. */
  queued?: boolean;
  /** "group" stage match or a reserved "knockout" bracket slot. */
  kind: "group" | "knockout";
}

type DaySlot = "all" | "morning" | "afternoon";

export function ScheduleTable({
  rows,
  tournamentId,
  canQueue = false,
}: {
  rows: ScheduleRow[];
  /** Required to enable the queued toggle (dashboard only). */
  tournamentId?: string;
  /** Show the queued on/off toggle in the Status column for un-scored matches. */
  canQueue?: boolean;
}) {
  const [q, setQ] = useState("");
  const [day, setDay] = useState<DaySlot>("all");
  const [group, setGroup] = useState("all");
  const [court, setCourt] = useState("all");
  const [category, setCategory] = useState("all");
  const [venue, setVenue] = useState("all");

  const groups = useMemo(
    () => [...new Set(rows.map((r) => r.group))].sort(),
    [rows],
  );
  const courts = useMemo(
    () => [...new Set(rows.map((r) => r.court))].sort(),
    [rows],
  );
  const venues = useMemo(
    () =>
      [...new Set(rows.map((r) => r.venue).filter(Boolean))].sort() as string[],
    [rows],
  );
  const categories = useMemo(
    () =>
      [...new Set(rows.map((r) => r.category).filter(Boolean))].sort() as string[],
    [rows],
  );
  const showCategory = categories.length > 1;
  const showVenue = rows.some((r) => r.venue);
  const showDate = rows.some((r) => r.date);

  const filtered = useMemo(() => {
    return rows
      .filter((r) => {
        const text =
          `${r.team1} ${r.team2} ${r.group} ${r.court} ${r.category ?? ""} ${r.venue ?? ""}`.toLowerCase();
        if (q && !text.includes(q.toLowerCase())) return false;
        if (group !== "all" && r.group !== group) return false;
        if (court !== "all" && r.court !== court) return false;
        if (category !== "all" && r.category !== category) return false;
        if (venue !== "all" && r.venue !== venue) return false;
        if (day !== "all" && r.time) {
          const noon = timeToMinutes(r.time) < 12 * 60;
          if (day === "morning" && !noon) return false;
          if (day === "afternoon" && noon) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const da = a.date ?? "9999-99-99";
        const db = b.date ?? "9999-99-99";
        if (da !== db) return da.localeCompare(db);
        const ta = a.time ? timeToMinutes(a.time) : 9999;
        const tb = b.time ? timeToMinutes(b.time) : 9999;
        if (ta !== tb) return ta - tb;
        return a.court.localeCompare(b.court);
      });
  }, [rows, q, day, group, court, category, venue]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search team, group or court…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <Pills
          value={day}
          onChange={(v) => setDay(v as DaySlot)}
          options={[
            { v: "all", l: "All day" },
            { v: "morning", l: "Morning" },
            { v: "afternoon", l: "Afternoon" },
          ]}
        />
        {showCategory && (
          <FilterSelect
            value={category}
            onChange={setCategory}
            all="All categories"
            options={categories}
          />
        )}
        {venues.length > 1 && (
          <FilterSelect
            value={venue}
            onChange={setVenue}
            all="All venues"
            options={venues}
          />
        )}
        <FilterSelect
          value={group}
          onChange={setGroup}
          all="All groups"
          options={groups}
        />
        <FilterSelect
          value={court}
          onChange={setCourt}
          all="All courts"
          options={courts}
        />
      </div>

      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-3">When &amp; where</th>
              {showCategory && <th className="px-3 py-3">Category</th>}
              <th className="px-3 py-3">Match</th>
              <th className="px-3 py-3">Group</th>
              <th className="px-3 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={4 + (showCategory ? 1 : 0)}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  No matches found.
                </td>
              </tr>
            ) : (
              filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border/50 last:border-0 hover:bg-accent/30"
                >
                  {/* Date, time, court and venue read as one block: when the
                      match is, then where. Only the parts the board actually
                      has are shown. */}
                  <td className="whitespace-nowrap px-3 py-3">
                    {showDate && (
                      <div className="text-xs text-muted-foreground">
                        {r.date ? formatDate(r.date) : "Date TBD"}
                      </div>
                    )}
                    <div className="font-medium tabular-nums">
                      {formatTime(r.time)}
                      <span className="px-1.5 text-muted-foreground">·</span>
                      <span className="font-normal">{r.court}</span>
                    </div>
                    {showVenue && (
                      <div className="text-xs text-muted-foreground">
                        {r.venue ?? "—"}
                      </div>
                    )}
                  </td>
                  {showCategory && (
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                      {r.category ?? "—"}
                    </td>
                  )}
                  <td className="px-3 py-3">
                    <span className="font-medium">{r.team1}</span>
                    <span className="mx-2 text-muted-foreground">vs</span>
                    <span className="font-medium">{r.team2}</span>
                  </td>
                  <td className="px-3 py-3">
                    {r.kind === "knockout" ? (
                      <Badge variant="default">
                        <Trophy />
                        {r.group}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{r.group}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {canQueue && tournamentId && r.status === "pending" ? (
                      <QueueToggle
                        tournamentId={tournamentId}
                        scheduleId={r.id}
                        queued={!!r.queued}
                      />
                    ) : (
                      <MatchStatusBadge status={r.status} />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pills({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div className="flex rounded-lg bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            value === o.v
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

/**
 * Green (on) / gray (off) toggle for a match's "queued" flag. Rendered in the
 * Status column only while a match has no score yet; once scored the parent
 * swaps this for the status badge instead.
 */
function QueueToggle({
  tournamentId,
  scheduleId,
  queued,
}: {
  tournamentId: string;
  scheduleId: string;
  queued: boolean;
}) {
  const [pending, startTransition] = useTransition();
  // Optimistic local state so the pill flips instantly on click.
  const [on, setOn] = useState(queued);

  function toggle() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const res = await toggleQueued(tournamentId, scheduleId, next);
      if (!res.ok) setOn(!next); // revert on failure
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60",
        on
          ? "bg-primary/20 text-primary hover:bg-primary/30"
          : "bg-muted text-muted-foreground hover:bg-muted/70",
      )}
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <span
          className={cn(
            "size-2 rounded-full",
            on ? "bg-primary" : "bg-muted-foreground/50",
          )}
        />
      )}
      {on ? "Queued" : "Queue"}
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  all,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  all: string;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-input bg-transparent px-3 text-sm outline-none"
    >
      <option value="all">{all}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
