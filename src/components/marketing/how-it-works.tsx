import {
  ArrowDown,
  ArrowRight,
  Check,
  Equal,
  Medal,
  Repeat2,
  Scale,
  Shuffle,
  Trophy,
  X,
} from "lucide-react";
import { ScrollFade } from "@/components/tournament/scroll-fade";
import { ADVANCE_PER_GROUP } from "@/lib/constants";
import { cn } from "@/lib/utils";

// The deep court green nearly matches a card in dark mode, so the "strong"
// highlights switch to the bright primary there to keep their contrast.
const STRONG = "bg-court text-court-foreground dark:bg-primary dark:text-primary-foreground";

/*
 * "How it works" for players and organisers on the marketing page.
 *
 * Every graphic is one worked example carried from step to step: 16 teams,
 * 4 groups, top 2 advance. The numbers are not illustrative guesses — the
 * group split is what `assignGroups` produces for 16 seeds, and the seeds and
 * round-one draw are what `generateFinalBracket` produces for these records,
 * including the A1-vs-A2 rematch it repairs. If the engine's rules change,
 * re-run the example through `src/services/` and update the data here.
 *
 * The graphics are real text, not images, so screen readers and search
 * engines get the explanation too.
 */

// Step 1 — seeds 1-16 split across 4 groups (assignGroups output).
const GROUPS = [
  { name: "A", seeds: [1, 6, 9, 14] },
  { name: "B", seeds: [2, 5, 10, 13] },
  { name: "C", seeds: [4, 7, 12, 15] },
  { name: "D", seeds: [3, 8, 11, 16] },
];

// Step 2 — Group A after its round robin.
const GROUP_A = [
  { team: "Dink Dynasty", rec: "3-0", diff: "+20" },
  { team: "Kitchen Kings", rec: "2-1", diff: "+4" },
  { team: "Third Shot Drop", rec: "1-2", diff: "-6" },
  { team: "Erne Express", rec: "0-3", diff: "-18" },
];

// Step 3 — the group tie-break chain (services/standings.ts).
const TIEBREAKS = [
  { title: "Most match wins", body: "The simple one — who won more." },
  {
    title: "Head-to-head",
    body: "Among the tied teams only, who beat whom.",
  },
  { title: "Most sets won", body: "Counts every game you took." },
  {
    title: "Point differential",
    body: "Points won minus points lost.",
  },
  { title: "Most points scored", body: "The last numbers-based check." },
];

// Step 4 — the qualifiers in seed order (rankQualifiers output).
const WINNERS = [
  { seed: 1, label: "B1", rec: "3-0", diff: "+25" },
  { seed: 2, label: "A1", rec: "3-0", diff: "+20" },
  { seed: 3, label: "D1", rec: "3-0", diff: "+15" },
  { seed: 4, label: "C1", rec: "2-1", diff: "+8" },
];
const RUNNERS_UP = [
  { seed: 5, label: "B2", rec: "2-1", diff: "+10" },
  { seed: 6, label: "C2", rec: "2-1", diff: "+6" },
  { seed: 7, label: "A2", rec: "2-1", diff: "+4" },
  { seed: 8, label: "D2", rec: "1-2", diff: "-2" },
];

// Step 5 — round one after the rematch repair (generateFinalBracket output).
const QUARTERS: [Team, Team][] = [
  [
    { seed: 1, label: "B1" },
    { seed: 7, label: "A2", moved: true },
  ],
  [
    { seed: 4, label: "C1" },
    { seed: 5, label: "B2" },
  ],
  [
    { seed: 2, label: "A1" },
    { seed: 8, label: "D2", moved: true },
  ],
  [
    { seed: 3, label: "D1" },
    { seed: 6, label: "C2" },
  ],
];

interface Team {
  seed: number;
  label: string;
  moved?: boolean;
}

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="mx-auto w-full max-w-6xl scroll-mt-6 px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="max-w-2xl">
        <p className="eyebrow text-primary">How it works</p>
        <h2
          id="how-heading"
          className="mt-1 text-4xl font-bold uppercase leading-none sm:text-5xl"
        >
          From groups to the final, explained
        </h2>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Every category plays the same two stages: a round robin in small
          groups, then a knockout bracket for the best teams. Here is one
          tournament followed the whole way through — 16 teams, 4 groups.
        </p>
      </div>

      <ol className="mt-12 space-y-6 sm:space-y-8">
        <Step
          n={1}
          title="Teams are split into groups"
          text={
            <>
              Teams are ranked into seeds (1 is the strongest), then spread
              across the groups so the top seeds start apart. Seeds 1, 2, 3
              and 4 each lead a different group — nobody gets stuck in a group
              of favourites.
            </>
          }
          graphic={<GroupsGraphic />}
        />
        <Step
          n={2}
          title="Everyone plays everyone in their group"
          text={
            <>
              Each group is a round robin: every team plays every other team
              once. When the last group match is done, the top{" "}
              {ADVANCE_PER_GROUP} of each group go through to the finals.
            </>
          }
          graphic={<GroupTableGraphic />}
        />
        <Step
          n={3}
          title="Ties are broken fairly, in order"
          text={
            <>
              If teams finish level, we go down this list until one check
              separates them. No coin flips: the same results always give the
              same order, and standings update live after every score.
            </>
          }
          graphic={<TiebreakGraphic />}
        />
        <Step
          n={4}
          title="Qualifiers are seeded for the finals"
          text={
            <>
              Every group winner is seeded above every runner-up. Inside each
              row, teams are ranked on their own results: win rate first (so
              smaller groups aren&apos;t at a disadvantage), then point
              differential, then points.
            </>
          }
          graphic={<SeedingGraphic />}
        />
        <Step
          n={5}
          title="The bracket is drawn — no instant rematches"
          text={
            <>
              The best seed plays the lowest seed (1 vs 8, 2 vs 7…), so the two
              strongest teams can only meet in the final. Teams from the same
              group never meet in round one — if the draw would pair them, we
              swap opponents with the nearest match. Lose once and you&apos;re
              out; the semifinal losers play for third.
            </>
          }
          graphic={<BracketGraphic />}
        />
      </ol>

      <GoodToKnow />
    </section>
  );
}

/* ------------------------------------------------------------------ layout */

function Step({
  n,
  title,
  text,
  graphic,
}: {
  n: number;
  title: string;
  text: React.ReactNode;
  graphic: React.ReactNode;
}) {
  return (
    <li className="grid gap-6 rounded-3xl border border-border bg-card p-5 shadow-card sm:p-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-10">
      <div>
        <div className="flex items-center gap-3">
          <span
            className={cn("scoreboard grid size-11 shrink-0 place-items-center rounded-xl text-2xl font-bold", STRONG)}
            aria-hidden
          >
            {n}
          </span>
          <span className="eyebrow">Step {n} of 5</span>
        </div>
        <h3 className="mt-4 font-heading text-3xl font-bold uppercase leading-[0.95] sm:text-4xl">
          {title}
        </h3>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          {text}
        </p>
      </div>
      <div className="min-w-0">{graphic}</div>
    </li>
  );
}

/** A soft court-tinted panel every graphic sits in. */
function Panel({
  className,
  children,
  label,
}: {
  className?: string;
  children: React.ReactNode;
  /** Short caption for screen readers and the corner tag. */
  label: string;
}) {
  return (
    <figure
      className={cn(
        "rounded-2xl border border-border bg-muted/50 p-4 sm:p-5",
        className,
      )}
    >
      <figcaption className="eyebrow mb-3">{label}</figcaption>
      {children}
    </figure>
  );
}

function SeedChip({
  seed,
  strong = false,
}: {
  seed: number;
  strong?: boolean;
}) {
  return (
    <span
      className={cn(
        "scoreboard grid size-9 place-items-center rounded-lg text-lg font-bold",
        strong
          ? STRONG
          : "border border-border bg-card text-foreground",
      )}
    >
      {seed}
    </span>
  );
}

/* ---------------------------------------------------------------- graphics */

function GroupsGraphic() {
  return (
    <Panel label="16 seeds · 4 groups">
      <div className="mb-4 flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: 16 }, (_, i) => (
          <SeedChip key={i} seed={i + 1} strong={i < 4} />
        ))}
      </div>
      <div className="mb-4 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
        <ArrowDown className="size-4 text-primary" aria-hidden />
        spread across the groups
        <ArrowDown className="size-4 text-primary" aria-hidden />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {GROUPS.map((g) => (
          <div
            key={g.name}
            className="rounded-xl border border-border bg-card p-3 shadow-card"
          >
            <p className="font-heading text-lg font-bold uppercase">
              Group {g.name}
            </p>
            <p className="sr-only">Seeds {g.seeds.join(", ")}</p>
            <div className="mt-2 grid w-fit grid-cols-2 gap-1.5" aria-hidden>
              {g.seeds.map((s) => (
                <SeedChip key={s} seed={s} strong={s <= 4} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-3 rounded-sm bg-court dark:bg-primary" aria-hidden />
        Top 4 seeds — one in every group
      </p>
    </Panel>
  );
}

function GroupTableGraphic() {
  return (
    <Panel label="Group A · final table">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="grid grid-cols-[1.5rem_1fr_2.75rem_2.5rem] gap-2 border-b border-border px-3 py-2 sm:grid-cols-[2.25rem_1fr_3.5rem_3rem] text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>#</span>
          <span>Team</span>
          <span className="text-right">W-L</span>
          <span className="text-right">+/-</span>
        </div>
        <ol>
          {GROUP_A.map((r, i) => {
            const advances = i < ADVANCE_PER_GROUP;
            return (
              <li
                key={r.team}
                className={cn(
                  "grid grid-cols-[1.5rem_1fr_2.75rem_2.5rem] items-center gap-2 sm:grid-cols-[2.25rem_1fr_3.5rem_3rem] border-b border-border px-3 py-2.5 last:border-b-0",
                  advances && "bg-primary/8 shadow-[inset_4px_0_0_0_var(--primary)]",
                )}
              >
                <span
                  className={cn(
                    "scoreboard text-xl font-bold",
                    advances ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-semibold sm:text-base">{r.team}</span>
                  {advances && (
                    <span className="hidden shrink-0 rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-primary-foreground sm:inline">
                      Advances
                    </span>
                  )}
                </span>
                <span className="scoreboard text-right text-lg font-bold">
                  {r.rec}
                </span>
                <span
                  className={cn(
                    "scoreboard text-right",
                    r.diff.startsWith("+") ? "text-success" : "text-destructive",
                  )}
                >
                  {r.diff}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <span className="h-3 w-1 rounded-full bg-primary" aria-hidden />
        Top {ADVANCE_PER_GROUP} go to the finals as A1 and A2
      </p>
    </Panel>
  );
}

function TiebreakGraphic() {
  return (
    <Panel label="If teams are level, check…">
      <ol className="space-y-2">
        {TIEBREAKS.map((t, i) => (
          <li
            key={t.title}
            className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 shadow-card"
            style={{ marginLeft: `${i * 0.6}rem` }}
          >
            <span className={cn("scoreboard grid size-8 shrink-0 place-items-center rounded-lg text-lg font-bold", STRONG)}>
              {i + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold leading-tight">
                {t.title}
              </span>
              <span className="block text-sm text-muted-foreground">
                {t.body}
              </span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Scale className="size-4 text-primary" aria-hidden />
        Still level? The team that won their match ranks higher.
      </p>
    </Panel>
  );
}

function SeedRow({
  title,
  icon: Icon,
  rows,
  tone,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: typeof WINNERS;
  tone: "winner" | "runner";
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 font-heading text-base font-bold uppercase tracking-wide">
        <Icon
          className={cn(
            "size-4",
            tone === "winner" ? "text-primary" : "text-chart-2",
          )}
          aria-hidden
        />
        {title}
      </p>
      <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-card"
          >
            <span
              className={cn(
                "scoreboard grid size-9 shrink-0 place-items-center rounded-lg text-xl font-bold",
                tone === "winner"
                  ? STRONG
                  : "bg-chart-2/12 text-chart-2",
              )}
            >
              <span className="sr-only">Seed </span>
              {r.seed}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block font-heading text-lg font-bold">
                {r.label}
              </span>
              <span className="scoreboard block text-sm text-muted-foreground">
                {r.rec} · {r.diff}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SeedingGraphic() {
  return (
    <Panel label="Finals seeds 1 – 8">
      <div className="space-y-4">
        <SeedRow
          title="Group winners"
          icon={Trophy}
          rows={WINNERS}
          tone="winner"
        />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span className="flex items-center gap-1.5">
            <ArrowDown className="size-4" aria-hidden /> always seeded below
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <SeedRow
          title="Runners-up"
          icon={Medal}
          rows={RUNNERS_UP}
          tone="runner"
        />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        B2 (2-1, +10) is seeded above A2 (2-1, +4): same record, better point
        differential.
      </p>
    </Panel>
  );
}

function MatchCard({
  top,
  bottom,
  className,
}: {
  top: Team | string;
  bottom: Team | string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-36 shrink-0 overflow-hidden rounded-xl border border-border bg-card text-sm shadow-card",
        className,
      )}
    >
      {[top, bottom].map((t, i) => (
        <div
          key={i}
          className={cn(
            "flex h-9 items-center gap-2 px-2.5",
            i === 0 && "border-b border-border",
          )}
        >
          {typeof t === "string" ? (
            <span className="text-muted-foreground">{t}</span>
          ) : (
            <>
              <span className="scoreboard w-4 text-right text-muted-foreground">
                {t.seed}
              </span>
              <span className="font-heading text-base font-bold">
                {t.label}
              </span>
              {t.moved && (
                <Repeat2
                  className="ml-auto size-4 text-chart-3"
                  aria-label="moved to avoid a rematch"
                />
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function BracketGraphic() {
  return (
    <Panel label="Round one, then knockout">
      {/* The rematch the draw avoids, before the bracket itself. */}
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/6 px-3 py-2 text-sm">
          <X className="size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            <span className="font-semibold">2 vs 7 = A1 vs A2</span>
            <span className="block text-muted-foreground">
              Same group — they already played
            </span>
          </span>
        </div>
        <ArrowRight
          className="mx-auto hidden size-5 text-muted-foreground sm:block"
          aria-hidden
        />
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/8 px-3 py-2 text-sm">
          <Check className="size-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-semibold">A2 and D2 swap places</span>
            <span className="block text-muted-foreground">
              A1 vs D2 · B1 vs A2
            </span>
          </span>
        </div>
      </div>

      <p className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground sm:hidden">
        Swipe to see the final <ArrowRight className="size-4" aria-hidden />
      </p>
      <ScrollFade>
        <div className="w-max min-w-full pb-1">
          <div className="mb-2 flex gap-7 text-left" aria-hidden>
            <p className="eyebrow w-36">Quarterfinals</p>
            <p className="eyebrow w-36">Semifinals</p>
            <p className="eyebrow flex w-36 items-center gap-1.5">
              <Trophy className="size-3.5 text-primary" /> Final
            </p>
          </div>
          {/* Nested pairs: each feeder pair sits beside a connector exactly as
              tall as the distance between the two match centres, so every
              line lands on the middle of its match. */}
          <div className="flex items-center">
            <div className="space-y-3">
              {[0, 1].map((half) => (
                <div key={half} className="flex items-center">
                  <div className="space-y-3">
                    <MatchCard
                      top={QUARTERS[half * 2][0]}
                      bottom={QUARTERS[half * 2][1]}
                    />
                    <MatchCard
                      top={QUARTERS[half * 2 + 1][0]}
                      bottom={QUARTERS[half * 2 + 1][1]}
                    />
                  </div>
                  <Joint inset="2.3125rem" />
                  <MatchCard
                    top={`Winner QF${half * 2 + 1}`}
                    bottom={`Winner QF${half * 2 + 2}`}
                  />
                </div>
              ))}
            </div>
            <Joint inset="5rem" />
            <MatchCard
              top="Winner SF1"
              bottom="Winner SF2"
              className="ring-2 ring-ball"
            />
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <p className="eyebrow flex items-center gap-1.5">
              <Medal className="size-3.5 text-chart-4" aria-hidden /> Third place
            </p>
            <MatchCard top="Loser SF1" bottom="Loser SF2" />
          </div>
        </div>
      </ScrollFade>
      <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <Repeat2 className="size-4 text-chart-3" aria-hidden />
        Moved to avoid a same-group rematch
      </p>
    </Panel>
  );
}

/**
 * The bracket line joining two feeder matches to the next round: a bracket
 * shape spanning the two match centres, then a stub into the next match.
 * `inset` is half a match card's height (or half a feeder block's), which is
 * where each centre sits.
 */
function Joint({ inset }: { inset: string }) {
  return (
    <div className="flex self-stretch" aria-hidden>
      <div
        className="w-3.5 rounded-r-md border-y-2 border-r-2 border-border"
        style={{ marginTop: inset, marginBottom: inset }}
      />
      <div className="my-auto h-0.5 w-3.5 bg-border" />
    </div>
  );
}

/* ---------------------------------------------------------- good to know */

const FACTS = [
  {
    icon: Shuffle,
    title: "Uneven numbers? Byes.",
    body: "If the finals field isn't 4, 8 or 16, the top seeds skip round one — a reward for a great group stage.",
  },
  {
    icon: Equal,
    title: "Never a coin flip",
    body: "Every tie-break is decided by results. Redrawing the bracket gives the exact same draw.",
  },
  {
    icon: Medal,
    title: "A match for bronze",
    body: "The two semifinal losers play once more, so third place is earned on court.",
  },
  {
    icon: Trophy,
    title: "Watch it live",
    body: "Standings, schedule and the bracket update on the tournament's public link as scores come in.",
  },
];

function GoodToKnow() {
  return (
    <div className="mt-10">
      <h3 className="font-heading text-2xl font-bold uppercase">
        Good to know
      </h3>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FACTS.map((f) => (
          <li
            key={f.title}
            className="rounded-2xl border border-border bg-card p-5 shadow-card"
          >
            <span className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <f.icon className="size-5" aria-hidden />
            </span>
            <p className="font-semibold">{f.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {f.body}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
