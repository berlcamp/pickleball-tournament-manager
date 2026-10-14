"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MatchStatusBadge } from "@/components/status-badge";
import { toggleQueued } from "@/actions/schedule";
import { formatDate, formatTime, timeToMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ScrollFade } from "@/components/tournament/scroll-fade";
import { Search, SearchX, Trophy } from "lucide-react";

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

  const statusCell = (r: ScheduleRow) =>
    canQueue && tournamentId && r.status === "pending" ? (
      <QueueToggle
        tournamentId={tournamentId}
        scheduleId={r.id}
        queued={!!r.queued}
      />
    ) : (
      <MatchStatusBadge status={r.status} />
    );

  const groupBadge = (r: ScheduleRow) =>
    r.kind === "knockout" ? (
      <Badge variant="default" className="shrink-0">
        <Trophy />
        {r.group}
      </Badge>
    ) : (
      <Badge variant="secondary" className="shrink-0">
        {r.group}
      </Badge>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <div className="relative sm:min-w-56 sm:flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search team, group or court…"
            aria-label="Search matches"
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
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
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
      </div>

      {filtered.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl px-6 py-10 text-center">
          <SearchX className="size-6 text-muted-foreground" />
          <p className="font-medium">No matches match these filters.</p>
          <p className="text-sm text-muted-foreground">
            Clear the search or pick &ldquo;All&rdquo; in the filters above.
          </p>
        </div>
      ) : (
        <>
          {/* Phones: one card per match — time and court first, since that is
              what a player scanning the board courtside is looking for. */}
          <ul className="space-y-2 sm:hidden">
            {filtered.map((r) => (
              <li
                key={r.id}
                className={cn(
                  "glass rounded-2xl p-3",
                  r.status === "in_progress" && "border-ball ring-2 ring-ball/40",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="scoreboard text-2xl font-bold leading-none">
                        {formatTime(r.time)}
                      </span>
                      <span className="font-heading text-base font-semibold uppercase tracking-wide text-primary">
                        {r.court}
                      </span>
                    </div>
                    {(showDate || showVenue || showCategory) && (
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {[
                          showDate ? (r.date ? formatDate(r.date) : "Date TBD") : null,
                          showVenue ? r.venue : null,
                          showCategory ? r.category : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  {groupBadge(r)}
                </div>
                <div className="mt-2.5 flex items-end justify-between gap-3">
                  <div className="min-w-0 text-[0.9375rem] leading-snug">
                    <div className="truncate font-semibold">{r.team1}</div>
                    <div className="truncate font-semibold">
                      <span className="mr-1.5 text-xs font-normal text-muted-foreground">
                        vs
                      </span>
                      {r.team2}
                    </div>
                  </div>
                  <div className="shrink-0">{statusCell(r)}</div>
                </div>
              </li>
            ))}
          </ul>

          <div className="glass hidden overflow-hidden rounded-2xl sm:block">
            <ScrollFade>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left font-heading text-[0.8125rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2.5">When &amp; where</th>
                    {showCategory && <th className="px-3 py-2.5">Category</th>}
                    <th className="px-3 py-2.5">Match</th>
                    <th className="px-3 py-2.5">Group</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className={cn(
                        "border-b border-border last:border-0 transition-colors duration-150 hover:bg-muted/60",
                        r.status === "in_progress" && "bg-ball/10 hover:bg-ball/15",
                      )}
                    >
                      {/* Date, time, court and venue read as one block: when the
                          match is, then where. Only the parts the board actually
                          has are shown. */}
                      <td className="whitespace-nowrap px-4 py-3">
                        {showDate && (
                          <div className="text-xs text-muted-foreground">
                            {r.date ? formatDate(r.date) : "Date TBD"}
                          </div>
                        )}
                        <div className="flex items-baseline gap-2">
                          <span className="scoreboard text-xl font-bold">
                            {formatTime(r.time)}
                          </span>
                          <span className="font-heading text-sm font-semibold uppercase tracking-wide text-primary">
                            {r.court}
                          </span>
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
                        <span className="font-semibold">{r.team1}</span>
                        <span className="mx-2 text-xs text-muted-foreground">vs</span>
                        <span className="font-semibold">{r.team2}</span>
                      </td>
                      <td className="px-3 py-3">{groupBadge(r)}</td>
                      <td className="px-3 py-3">{statusCell(r)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollFade>
          </div>
        </>
      )}
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
    <div className="flex rounded-xl bg-muted p-1" role="group" aria-label="Time of day">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cn(
            "min-h-10 flex-1 rounded-lg px-3 font-heading text-[0.95rem] font-semibold uppercase tracking-wide transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8 sm:flex-none",
            value === o.v
              ? "bg-court text-court-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

/**
 * On / off toggle for a match's "queued" flag. Rendered in the Status column
 * only while a match has no score yet; once scored the parent swaps this for
 * the status badge instead.
 *
 * Optimistic: the pill flips on tap and stays tappable. `useOptimistic` holds
 * the new value while the save runs, then hands back to the server's value —
 * which is the new one on success and the old one (plus a toast) on failure.
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
  const [on, setOn] = useOptimistic(queued);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    startTransition(async () => {
      setOn(next);
      const res = await toggleQueued(tournamentId, scheduleId, next);
      if (!res.ok) toast.error(res.error ?? "Couldn't update the queue.");
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={on}
      aria-busy={pending || undefined}
      title={on ? "Called to court — tap to undo" : "Mark as called to court next"}
      className={cn(
        "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] sm:min-h-7 sm:px-2.5",
        on
          ? "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_10%)]"
          : "bg-muted text-muted-foreground hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)] hover:text-foreground",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          on ? "bg-primary-foreground" : "bg-muted-foreground/50",
          pending && "animate-pulse",
        )}
      />
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
      aria-label={all}
      className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-9 sm:w-auto sm:text-sm dark:bg-input/30"
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
