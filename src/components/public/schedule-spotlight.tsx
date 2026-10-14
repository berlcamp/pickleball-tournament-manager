import type { ScheduleRow } from "@/components/tournament/schedule-table";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { BellRing, Radio } from "lucide-react";

/** Most matches shown in either strip — a venue rarely has more courts. */
const MAX_CARDS = 6;

const slotKey = (r: ScheduleRow) => `${r.date ?? ""}|${r.time ?? ""}`;

/**
 * "Now playing" and "Up next" strips above the full schedule, so a player
 * opening the link courtside sees the answer to "when am I on?" first.
 *
 * Now playing is every match scored as in progress. Up next is what staff
 * have called to the court (`queued`); when nobody has called anything, it
 * falls back to the earliest unplayed time slot.
 */
export function ScheduleSpotlight({ rows }: { rows: ScheduleRow[] }) {
  const live = rows.filter((r) => r.status === "in_progress");
  const pending = rows
    .filter((r) => r.status === "pending")
    .sort((a, b) => (slotKey(a) < slotKey(b) ? -1 : slotKey(a) > slotKey(b) ? 1 : 0));

  const called = pending.filter((r) => r.queued);
  let next = called;
  if (next.length === 0 && pending.length > 0) {
    const first = slotKey(pending[0]);
    next = pending.filter((r) => slotKey(r) === first);
  }

  if (live.length === 0 && next.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {live.length > 0 && (
        <Strip
          title="Now playing"
          icon={Radio}
          tone="live"
          rows={live.slice(0, MAX_CARDS)}
        />
      )}
      {next.length > 0 && (
        <Strip
          title={called.length > 0 ? "Called to court" : "Up next"}
          icon={BellRing}
          tone="next"
          rows={next.slice(0, MAX_CARDS)}
        />
      )}
    </div>
  );
}

function Strip({
  title,
  icon: Icon,
  tone,
  rows,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "live" | "next";
  rows: ScheduleRow[];
}) {
  const live = tone === "live";
  return (
    <section
      aria-label={title}
      className={cn(
        "overflow-hidden rounded-2xl border shadow-card",
        live
          ? "border-court bg-court text-court-foreground"
          : "border-border bg-card",
      )}
    >
      <header
        className={cn(
          "flex items-center gap-2 px-4 py-2.5",
          live ? "border-b border-court-foreground/15" : "border-b border-border",
        )}
      >
        {live ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ball px-2 py-0.5 font-heading text-xs font-bold uppercase tracking-[0.12em] text-ball-foreground">
            <span className="relative flex size-1.5" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-ball-foreground/60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-ball-foreground" />
            </span>
            Live
          </span>
        ) : (
          <Icon className="size-4 text-primary" aria-hidden />
        )}
        <h2 className="text-lg font-bold uppercase leading-none tracking-wide">
          {title}
        </h2>
        <span
          className={cn(
            "scoreboard ml-auto text-sm",
            live ? "text-court-foreground/75" : "text-muted-foreground",
          )}
        >
          {rows.length} {rows.length === 1 ? "match" : "matches"}
        </span>
      </header>
      <ul
        className={cn(
          "divide-y",
          live ? "divide-court-foreground/12" : "divide-border",
        )}
      >
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-4 py-3">
            <div
              className={cn(
                "flex w-16 shrink-0 flex-col items-center rounded-xl px-1 py-1.5 text-center",
                live ? "bg-court-foreground/10" : "bg-muted",
              )}
            >
              <span
                className={cn(
                  "font-heading text-[0.65rem] font-semibold uppercase tracking-[0.1em]",
                  live ? "text-court-foreground/75" : "text-muted-foreground",
                )}
              >
                Court
              </span>
              <span className="scoreboard max-w-full truncate text-xl font-bold leading-none">
                {r.court.replace(/^court\s*/i, "") || r.court}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "truncate font-heading text-xs font-semibold uppercase tracking-[0.08em]",
                  live ? "text-court-foreground/75" : "text-muted-foreground",
                )}
              >
                {[r.category, r.group].filter(Boolean).join(" · ")}
              </div>
              <div className="truncate text-sm font-semibold">{r.team1}</div>
              <div className="truncate text-sm font-semibold">
                <span
                  className={cn(
                    "mr-1 font-normal",
                    live ? "text-court-foreground/70" : "text-muted-foreground",
                  )}
                >
                  vs
                </span>
                {r.team2}
              </div>
            </div>
            {!live && r.time && (
              <div className="shrink-0 text-right">
                <div className="scoreboard text-lg font-bold leading-none">
                  {formatTime(r.time)}
                </div>
                {r.date && (
                  <div className="mt-0.5 text-[0.7rem] text-muted-foreground">
                    {formatDate(r.date)}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
