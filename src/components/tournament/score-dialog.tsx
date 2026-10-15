"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { AlertCircle, Check, Loader2, Plus, X } from "lucide-react";

export interface SetScore {
  participant1_score: number;
  participant2_score: number;
}

interface EditableSet {
  p1: string;
  p2: string;
}

/**
 * Sets won by each side. Mirrors `winnerFromSets` in the score actions (a
 * level set counts for nobody), so the winner the UI shows the moment a score
 * is entered is the one the server will store.
 */
export function setTally(sets: SetScore[]) {
  let p1 = 0;
  let p2 = 0;
  for (const s of sets) {
    if (s.participant1_score > s.participant2_score) p1++;
    else if (s.participant2_score > s.participant1_score) p2++;
  }
  return { p1, p2 };
}

/** The winning side's id for a set list, or null when the sets are level. */
export function winnerOf(
  sets: SetScore[],
  team1Id: string | null,
  team2Id: string | null,
) {
  const { p1, p2 } = setTally(sets);
  return p1 > p2 ? team1Id : p2 > p1 ? team2Id : null;
}

// Keep only digits and drop leading zeros so that typing a non-zero digit into
// a field showing "0" replaces it (e.g. "0" + "5" -> "5"). A lone "0" stays "0".
// Two digits at most: the validator caps a set score at 99.
function normalizeScore(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 3);
  if (digits === "") return "";
  const stripped = digits.replace(/^0+/, "").slice(0, 2);
  return stripped === "" ? "0" : stripped;
}

function toEditable(sets?: SetScore[]): EditableSet[] {
  if (!sets || !sets.length) return [{ p1: "", p2: "" }];
  return sets.map((s) => ({
    p1: String(s.participant1_score),
    p2: String(s.participant2_score),
  }));
}

const isBlank = (s: EditableSet) => s.p1 === "" && s.p2 === "";

/** What is wrong with one set, if anything. Errors block saving. */
function setError(s: EditableSet): string | null {
  if (s.p1 === "" || s.p2 === "") return "Enter both scores for this set.";
  if (s.p1 === "0" && s.p2 === "0") return "A set can't end 0–0.";
  return null;
}

/**
 * Courtside score entry. Built for a phone held in one hand: big numeric
 * fields that open the number pad, the first one focused on open, and the
 * running result shown above so the scorer can see they typed it the right
 * way round before saving.
 *
 * The dialog stays open until the save is confirmed: `onSubmit` resolves to
 * an error message (or null on success). While it runs the fields lock and
 * the dialog can't be dismissed, so a score is never lost by closing it early;
 * a failure is shown in place, with the typed score still there to retry.
 */
export function ScoreDialog({
  open,
  onOpenChange,
  team1,
  team2,
  title = "Enter score",
  initialSets,
  requireWinner = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  team1: string;
  team2: string;
  /** e.g. the bracket match label ("Semifinal 1"). */
  title?: string;
  initialSets?: SetScore[];
  /** Knockout matches: warn when the sets are level, since nobody advances. */
  requireWinner?: boolean;
  onSubmit: (sets: SetScore[]) => Promise<string | null>;
}) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sets, setSets] = useState<EditableSet[]>(() => toEditable(initialSets));
  // Blank-field errors only appear after a save attempt, so the form doesn't
  // open already shouting at the scorer.
  const [attempted, setAttempted] = useState(false);
  const firstInput = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // Set when "Add set" is pressed, so the new row's first field takes focus.
  const focusSet = useRef<number | null>(null);

  useEffect(() => {
    if (focusSet.current == null) return;
    field(focusSet.current, 1)?.focus();
    focusSet.current = null;
  }, [sets.length]);

  function field(i: number, side: 1 | 2) {
    return formRef.current?.querySelector<HTMLInputElement>(
      `[data-set="${i}"][data-side="${side}"]`,
    );
  }

  function update(i: number, side: 1 | 2, value: string) {
    const next = normalizeScore(value);
    setSets((prev) =>
      prev.map((s, idx) =>
        idx === i ? { ...s, [side === 1 ? "p1" : "p2"]: next } : s,
      ),
    );
  }

  // A completely empty extra row (an accidental "Add set") is dropped rather
  // than reported — as long as at least one real set remains.
  const filled = sets.filter((s) => !isBlank(s));
  const considered = filled.length > 0 ? filled : sets;
  const errors = sets.map((s) =>
    filled.length > 0 && isBlank(s) ? null : setError(s),
  );
  const hasError = errors.some(Boolean);

  const complete: SetScore[] = considered
    .filter((s) => s.p1 !== "" && s.p2 !== "")
    .map((s) => ({
      participant1_score: Number(s.p1),
      participant2_score: Number(s.p2),
    }));
  const tally = setTally(complete);
  const leader = tally.p1 > tally.p2 ? 1 : tally.p2 > tally.p1 ? 2 : null;

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (saving) return;
    setAttempted(true);
    if (hasError) {
      const bad = errors.findIndex(Boolean);
      const s = sets[bad];
      field(bad, s && s.p1 === "" ? 1 : 2)?.focus();
      return;
    }
    setSaving(true);
    setSaveError(null);
    const error = await onSubmit(
      considered.map((s) => ({
        participant1_score: Number(s.p1),
        participant2_score: Number(s.p2),
      })),
    );
    setSaving(false);
    if (error) setSaveError(error);
    else onOpenChange(false);
  }

  // Enter on the left score moves to the right one while it is still empty
  // (the "next" key on a phone's number pad); anywhere else it saves.
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, i: number, side: 1 | 2) {
    if (e.key !== "Enter" || side !== 1) return;
    if (sets[i]?.p2 === "") {
      e.preventDefault();
      field(i, 2)?.focus();
    }
  }

  const levelMatch = complete.length > 0 && leader === null;

  return (
    <Dialog
      open={open}
      // Escape, the backdrop and the close button are all ignored mid-save.
      onOpenChange={(v) => !saving && onOpenChange(v)}
    >
      <DialogContent
        initialFocus={firstInput}
        showCloseButton={!saving}
        className="gap-5 sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-bold">
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Enter each set&apos;s points for {team1} and {team2}.
          </DialogDescription>
        </DialogHeader>

        {/* The running result — who is ahead on sets, live as you type. */}
        <div
          className="bg-court-lines grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-court px-3 py-3 text-court-foreground"
          aria-live="polite"
        >
          <TeamTag name={team1} leading={leader === 1} align="right" />
          <div className="scoreboard flex items-center gap-1.5 text-4xl font-bold leading-none">
            <span className={cn(leader === 1 && "text-ball")}>{tally.p1}</span>
            <span className="text-2xl text-court-foreground/50">–</span>
            <span className={cn(leader === 2 && "text-ball")}>{tally.p2}</span>
          </div>
          <TeamTag name={team2} leading={leader === 2} align="left" />
        </div>

        <form
          ref={formRef}
          onSubmit={submit}
          className="space-y-3"
          noValidate
          aria-busy={saving || undefined}
        >
          {/* `disabled` on a fieldset locks every field and button inside. */}
          <fieldset disabled={saving} className="min-w-0 space-y-3">
          {sets.map((s, i) => {
            const error = errors[i];
            const shownError =
              error && (attempted || (s.p1 !== "" && s.p2 !== ""))
                ? error
                : null;
            const level =
              !error && s.p1 !== "" && s.p2 !== "" && s.p1 === s.p2;
            const win = !error && s.p1 !== "" && s.p2 !== ""
              ? Number(s.p1) > Number(s.p2)
                ? 1
                : Number(s.p2) > Number(s.p1)
                  ? 2
                  : null
              : null;
            const errId = `set-${i}-msg`;
            return (
              <div
                key={i}
                role="group"
                aria-label={`Set ${i + 1}`}
                className="space-y-1.5"
              >
                <div className="flex min-h-6 items-center justify-between">
                  <span className="eyebrow">Set {i + 1}</span>
                  {sets.length > 1 && (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="-mr-1 text-muted-foreground"
                      aria-label={`Remove set ${i + 1}`}
                      onClick={() =>
                        setSets((prev) => prev.filter((_, idx) => idx !== i))
                      }
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  {([1, 2] as const).map((side) => (
                    <ScoreInput
                      key={side}
                      ref={i === 0 && side === 1 ? firstInput : undefined}
                      set={i}
                      side={side}
                      label={`${side === 1 ? team1 : team2}, set ${i + 1}`}
                      value={side === 1 ? s.p1 : s.p2}
                      winning={win === side}
                      invalid={!!shownError}
                      describedBy={shownError || level ? errId : undefined}
                      onChange={(v) => update(i, side, v)}
                      onKeyDown={(e) => onKeyDown(e, i, side)}
                      className={side === 1 ? "order-1" : "order-3"}
                    />
                  ))}
                  <span
                    aria-hidden
                    className="scoreboard order-2 text-2xl font-bold text-muted-foreground"
                  >
                    –
                  </span>
                </div>
                {shownError ? (
                  <p
                    id={errId}
                    className="flex items-center gap-1.5 text-sm font-medium text-destructive"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    {shownError}
                  </p>
                ) : level ? (
                  <p
                    id={errId}
                    className="flex items-center gap-1.5 text-sm text-warning"
                  >
                    <AlertCircle className="size-4 shrink-0" />
                    Level set — it counts for neither team.
                  </p>
                ) : null}
              </div>
            );
          })}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={() => {
              focusSet.current = sets.length;
              setSets((prev) => [...prev, { p1: "", p2: "" }]);
            }}
          >
            <Plus className="size-4" /> Add set
          </Button>

          {requireWinner && levelMatch && (
            <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-3 py-2 text-sm text-foreground">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
              Sets are level, so nobody advances. Add the deciding set before
              saving.
            </p>
          )}

          </fieldset>

          {saveError && (
            <p
              role="alert"
              className="flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>
                The score wasn&apos;t saved. {saveError} Check your connection
                and try again.
              </span>
            </p>
          )}

          <DialogFooter>
            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-auto"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {saving ? "Saving…" : saveError ? "Try again" : "Save score"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeamTag({
  name,
  leading,
  align,
}: {
  name: string;
  leading: boolean;
  align: "left" | "right";
}) {
  return (
    <span
      className={cn(
        "line-clamp-2 min-w-0 break-words text-sm leading-tight font-semibold",
        align === "right" ? "text-right" : "text-left",
        leading ? "text-ball" : "text-court-foreground/80",
      )}
    >
      {name}
    </span>
  );
}

function ScoreInput({
  ref,
  set,
  side,
  label,
  value,
  winning,
  invalid,
  describedBy,
  onChange,
  onKeyDown,
  className,
}: {
  ref?: React.Ref<HTMLInputElement>;
  set: number;
  side: 1 | 2;
  label: string;
  value: string;
  winning: boolean;
  invalid: boolean;
  describedBy?: string;
  onChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      enterKeyHint={side === 1 ? "next" : "done"}
      placeholder="0"
      aria-label={label}
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      data-set={set}
      data-side={side}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={(e) => e.currentTarget.select()}
      className={cn(
        "scoreboard h-16 w-full min-w-0 rounded-xl border-2 border-input bg-card text-center text-4xl font-bold outline-none transition-colors duration-150",
        "placeholder:text-muted-foreground/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40",
        "dark:bg-input/30",
        winning && "border-primary bg-primary/8 text-primary",
        invalid && "border-destructive focus-visible:ring-destructive/25",
        className,
      )}
    />
  );
}
