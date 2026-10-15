"use client";

import { useState } from "react";
import {
  ArrowRight,
  ListOrdered,
  Network,
  Shuffle,
  Trophy,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ADVANCE_PER_GROUP } from "@/lib/constants";
import { cn } from "@/lib/utils";

export interface SeedVM {
  /** Overall seed across every group (1 = best). */
  seed: number;
  /** Where the team comes from, e.g. "A1" = Group A winner. */
  label: string;
  group: string;
  position: number;
  /** Null while the group has no result in yet. */
  name: string | null;
  won: number;
  lost: number;
  tied: number;
  played: number;
  pointDiff: number;
}

export interface FirstRoundVM {
  /** Null = bye. */
  a: SeedVM | null;
  b: SeedVM | null;
  /** Moved away from strict 1-v-N seeding to avoid a same-group rematch. */
  moved: boolean;
}

export interface SeedingSnapshot {
  seeds: SeedVM[];
  firstRound: FirstRoundVM[];
  bracketSize: number;
}

const TIER_NAMES = ["Group winners", "Runners-up", "Third places"];
const tierName = (position: number) =>
  TIER_NAMES[position - 1] ?? `${position}th places`;

const PLACE_NAMES = ["Winner", "Runner-up", "3rd place"];
const placeName = (position: number) =>
  PLACE_NAMES[position - 1] ?? `${position}th place`;

const fmtDiff = (n: number) => (n > 0 ? `+${n}` : `${n}`);

/**
 * A button that opens the current overall finals seeding: group winners and
 * runners-up in seed order, and the round-one pairings that order produces,
 * with a short illustrated explanation of how the bracket is drawn from it.
 */
export function FinalsSeedingDialog({
  snapshot,
  locked,
}: {
  snapshot: SeedingSnapshot;
  /** The group stage is over: these are the seeds the bracket was drawn from. */
  locked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { seeds, firstRound } = snapshot;

  const tiers = new Map<number, SeedVM[]>();
  for (const s of seeds) {
    if (!tiers.has(s.position)) tiers.set(s.position, []);
    tiers.get(s.position)!.push(s);
  }
  const anyMoved = firstRound.some((m) => m.moved);
  const byes = firstRound.filter((m) => !m.a || !m.b).length;
  // Number only the matches actually played; byes are shown but not counted.
  let played = 0;
  const matchNo = firstRound.map((m) => (m.a && m.b ? ++played : 0));

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ListOrdered className="size-4" aria-hidden />
        Finals seeding
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-bold">
              Finals seeding
            </DialogTitle>
            <DialogDescription>
              {locked
                ? "The final seeds — the bracket was drawn from this order."
                : "Live — this order moves as group scores come in. The real bracket is drawn when the group stage ends."}
            </DialogDescription>
          </DialogHeader>

          {/* ---------- 1. the three steps ---------- */}
          <ol className="grid grid-cols-3 gap-1.5 sm:gap-2" aria-label="How the bracket is made">
            <Step
              icon={Users}
              title={`Top ${ADVANCE_PER_GROUP} qualify`}
              body="From every group"
            />
            <Step
              icon={ListOrdered}
              title="One order"
              body="Ranked 1 to N"
              arrow
            />
            <Step
              icon={Network}
              title="1 plays N"
              body="Best vs. weakest"
              arrow
            />
          </ol>

          {/* ---------- 2. the seed list ---------- */}
          <section aria-labelledby="seeds-heading" className="space-y-3">
            <h3 id="seeds-heading" className="eyebrow text-primary">
              Current seeds
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {[...tiers.entries()].map(([position, list]) => (
                <div
                  key={position}
                  className="overflow-hidden rounded-xl border border-border"
                >
                  <p
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 font-heading text-sm font-bold uppercase tracking-wider",
                      position === 1
                        ? "bg-court text-court-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {position === 1 && (
                      <Trophy className="size-3.5 text-ball" aria-hidden />
                    )}
                    {tierName(position)}
                  </p>
                  <ol className="divide-y divide-border">
                    {list.map((s) => (
                      <SeedRow key={s.label} seed={s} top={position === 1} />
                    ))}
                  </ol>
                </div>
              ))}
            </div>
            <p className="rounded-xl bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                Every group winner is seeded above every runner-up.
              </span>{" "}
              Inside each tier, teams are ranked on their own results: win
              rate first, then point differential, then points scored.
            </p>
          </section>

          {/* ---------- 3. round one ---------- */}
          <section aria-labelledby="round-one-heading" className="space-y-3">
            <h3 id="round-one-heading" className="eyebrow text-primary">
              Round one draw
            </h3>
            <ol className="grid gap-2 sm:grid-cols-2">
              {firstRound.map((m, i) => {
                if (!m.a || !m.b) {
                  const walkover = m.a ?? m.b;
                  if (!walkover) return null;
                  // Nothing is played: the top seed goes straight through.
                  return (
                    <li
                      key={i}
                      className="rounded-xl border border-dashed border-border bg-muted/30 p-2"
                    >
                      <p className="mb-1 px-1 font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Bye · straight to next round
                      </p>
                      <MatchSide seed={walkover} />
                    </li>
                  );
                }
                return (
                  <li
                    key={i}
                    className={cn(
                      "rounded-xl border bg-card p-2",
                      m.moved ? "border-chart-4/60" : "border-border",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between px-1">
                      <span className="font-heading text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Match {matchNo[i]}
                      </span>
                      {m.moved && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-chart-4/15 px-2 py-0.5 text-[11px] font-semibold text-chart-4">
                          <Shuffle className="size-3" aria-hidden />
                          Swapped
                        </span>
                      )}
                    </div>
                    <MatchSide seed={m.a} />
                    <div className="my-0.5 flex items-center gap-2 px-1" aria-hidden>
                      <span className="h-px flex-1 bg-border" />
                      <span className="font-heading text-[11px] font-bold uppercase text-muted-foreground">
                        vs
                      </span>
                      <span className="h-px flex-1 bg-border" />
                    </div>
                    <MatchSide seed={m.b} />
                  </li>
                );
              })}
            </ol>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <Note>
                The best seed plays the weakest, 2nd plays 2nd-weakest, and so
                on — so seeds 1 and 2 can only meet in the final.
              </Note>
              {byes > 0 && (
                <Note>
                  {byes === 1 ? "One bye goes" : `${byes} byes go`} to the top
                  seed{byes === 1 ? "" : "s"} — they move straight to the next
                  round.
                </Note>
              )}
              <Note>
                Teams from the same group never meet in round one — they
                already played each other.
                {anyMoved &&
                  " Matches marked Swapped had an opponent exchanged to avoid that rematch."}
              </Note>
            </ul>
          </section>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Step({
  icon: Icon,
  title,
  body,
  arrow,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  arrow?: boolean;
}) {
  return (
    <li className="relative flex flex-col items-center rounded-xl bg-muted/50 px-1.5 py-3 text-center">
      {arrow && (
        <span
          aria-hidden
          className="absolute top-1/2 -left-2.5 z-10 grid size-4 -translate-y-1/2 place-items-center rounded-full bg-background text-muted-foreground sm:-left-3 sm:size-5"
        >
          <ArrowRight className="size-3" />
        </span>
      )}
      <span className="grid size-9 place-items-center rounded-lg bg-primary/12 text-primary">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span className="mt-2 font-heading text-sm font-bold uppercase leading-tight sm:text-base">
        {title}
      </span>
      <span className="text-xs text-muted-foreground">{body}</span>
    </li>
  );
}

function SeedRow({ seed: s, top }: { seed: SeedVM; top: boolean }) {
  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      <span
        className={cn(
          "scoreboard grid size-8 shrink-0 place-items-center rounded-md text-base font-bold",
          top ? "bg-court text-court-foreground" : "bg-primary/12 text-primary",
        )}
        aria-label={`Seed ${s.seed}`}
      >
        {s.seed}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-sm font-semibold",
            !s.name && "text-muted-foreground",
          )}
        >
          {s.name ?? "To be decided"}
        </span>
        <span className="text-xs text-muted-foreground">
          {s.label} · Group {s.group}
        </span>
      </span>
      {s.played > 0 ? (
        <span className="shrink-0 text-right">
          <span className="scoreboard block text-base font-bold leading-tight">
            {s.won}-{s.lost}
            {s.tied > 0 && `-${s.tied}`}
          </span>
          <span
            className={cn(
              "scoreboard block text-xs",
              s.pointDiff > 0
                ? "text-success"
                : s.pointDiff < 0
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {fmtDiff(s.pointDiff)}
          </span>
        </span>
      ) : (
        <span className="shrink-0 text-xs text-muted-foreground">No games</span>
      )}
    </li>
  );
}

function MatchSide({ seed: s }: { seed: SeedVM }) {
  return (
    <div className="flex min-h-9 items-center gap-2 rounded-lg px-1">
      <span
        className={cn(
          "scoreboard grid size-6 shrink-0 place-items-center rounded-md text-sm font-bold",
          s.position === 1
            ? "bg-court text-court-foreground"
            : "bg-primary/12 text-primary",
        )}
      >
        {s.seed}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-medium",
          !s.name && "text-muted-foreground",
        )}
      >
        {s.name ?? `${placeName(s.position)}, Group ${s.group}`}
      </span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-heading text-xs font-bold text-muted-foreground">
        {s.label}
      </span>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <ArrowRight className="mt-1 size-3.5 shrink-0 text-primary" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
