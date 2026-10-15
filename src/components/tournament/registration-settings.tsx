"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCategoryRegistration } from "@/actions/registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import {
  registrationAvailability,
  CLOSED_MESSAGES,
  feeUnit,
} from "@/services/registration";
import { FORMAT_LABELS } from "@/lib/constants";
import type { Category, CategoryFormat } from "@/types";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ClipboardList,
  IdCard,
  Loader2,
  Lock,
  Shirt,
  Shuffle,
  User,
  Users,
  Wallet,
} from "lucide-react";

/** ISO timestamp → the local "YYYY-MM-DDTHH:mm" a datetime-local input wants. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** "Oct 3, 6:00 PM" for the row summary. */
function shortDeadline(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const FORMATS: {
  value: CategoryFormat;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}[] = [
  { value: "doubles", icon: Users, hint: "Pairs sign up together" },
  { value: "singles", icon: User, hint: "One player per entry" },
  { value: "blind_pairing", icon: Shuffle, hint: "Players sign up alone; partners are drawn" },
];

/** The settings a save sends, in the shape `updateCategoryRegistration` takes. */
interface Draft {
  format: CategoryFormat;
  open: boolean;
  deadline: string;
  maxTeams: string;
  fee: string;
  upfront: boolean;
  shirts: boolean;
  shirtPrice: string;
  needsId: boolean;
}

function draftOf(c: Category): Draft {
  return {
    format: c.format,
    open: c.registration_open,
    deadline: toLocalInput(c.registration_deadline),
    maxTeams: c.max_teams === null ? "" : String(c.max_teams),
    fee: String(Number(c.registration_fee)),
    upfront: c.require_payment_upfront,
    shirts: c.collect_shirt_sizes,
    shirtPrice: String(Number(c.shirt_price)),
    needsId: c.require_player_id,
  };
}

function payload(d: Draft) {
  return {
    format: d.format,
    registration_open: d.open,
    // Convert here, in the manager's browser: `datetime-local` carries no
    // zone, and the server runs in UTC.
    registration_deadline: d.deadline ? new Date(d.deadline).toISOString() : "",
    max_teams: d.maxTeams === "" ? "" : Number(d.maxTeams),
    registration_fee: Number(d.fee || 0),
    require_payment_upfront: Number(d.fee || 0) > 0 && d.upfront,
    collect_shirt_sizes: d.shirts,
    shirt_price: Number(d.shirtPrice || 0),
    require_player_id: d.needsId,
  };
}

export function RegistrationSettings({
  tournamentId,
  categories,
  approvedCounts,
}: {
  tournamentId: string;
  categories: Category[];
  approvedCounts: Record<string, number>;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="size-5" />
        </span>
        <div>
          <h2 className="font-heading text-2xl font-bold">
            Public registration
          </h2>
          <p className="text-sm text-muted-foreground">
            Flip a switch to let players sign up from your public page. Open a
            category to set its fee and what to collect.
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {categories.map((category) => (
          <CategoryRegistrationRow
            key={category.id}
            tournamentId={tournamentId}
            category={category}
            approvedCount={approvedCounts[category.id] ?? 0}
          />
        ))}
      </ul>
    </section>
  );
}

function CategoryRegistrationRow({
  tournamentId,
  category,
  approvedCount,
}: {
  tournamentId: string;
  category: Category;
  approvedCount: number;
}) {
  const [pending, startTransition] = useTransition();
  const [toggling, startToggle] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftOf(category));
  const [saved, setSaved] = useState(false);

  const stored = draftOf(category);
  const dirty = (Object.keys(draft) as (keyof Draft)[]).some(
    // The open switch saves on its own, so it never counts as unsaved.
    (k) => k !== "open" && draft[k] !== stored[k],
  );

  // Once the group stage starts the bracket is fixed, so entries are closed.
  const locked = category.status !== "draft";
  const availability = registrationAvailability(category, approvedCount);
  const unit = feeUnit(draft.format);
  const fee = Number(draft.fee || 0);

  // Caught here so the problem shows beside the field, not as a toast after
  // the round trip.
  const feeProblem = fee < 0 ? "The fee can't be negative." : null;
  const maxProblem =
    draft.maxTeams !== "" &&
    (!Number.isInteger(Number(draft.maxTeams)) || Number(draft.maxTeams) < 1)
      ? "Use a whole number of at least 1, or leave it empty."
      : null;
  const shirtProblem =
    Number(draft.shirtPrice || 0) < 0 ? "The price can't be negative." : null;
  const invalid = Boolean(feeProblem || maxProblem || shirtProblem);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      const res = await updateCategoryRegistration(
        tournamentId,
        category.id,
        payload({ ...draft, open: category.registration_open }),
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${category.name} registration saved`);
      setSaved(true);
    });
  }

  // The switch saves straight away, from the stored settings — any unsaved
  // edits below it stay as they are.
  function toggleOpen(next: boolean) {
    set("open", next);
    startToggle(async () => {
      const res = await updateCategoryRegistration(
        tournamentId,
        category.id,
        payload({ ...stored, open: next }),
      );
      if (!res.ok) {
        set("open", !next);
        toast.error(res.error);
        return;
      }
      toast.success(
        next
          ? `${category.name} is open for registration`
          : `${category.name} registration closed`,
      );
    });
  }

  const statusPill = locked ? (
    <Pill tone="muted">
      <Lock className="size-3" /> Started
    </Pill>
  ) : draft.open && availability.open ? (
    <Pill tone="ball">Open</Pill>
  ) : draft.open ? (
    <Pill tone="warning">Paused</Pill>
  ) : (
    <Pill tone="muted">Closed</Pill>
  );

  return (
    <li
      className={cn(
        "overflow-hidden rounded-xl border transition-colors",
        expanded ? "border-primary/40" : "border-border",
      )}
    >
      <div className="flex items-center gap-2 pr-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={`reg-${category.id}`}
          className="flex min-h-16 min-w-0 flex-1 items-center gap-3 p-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
        >
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-heading text-lg font-bold leading-tight">
                {category.name}
              </span>
              {statusPill}
            </span>
            <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span>{FORMAT_LABELS[category.format]}</span>
              <span>
                {Number(category.registration_fee) > 0
                  ? `${formatCurrency(Number(category.registration_fee))} / ${feeUnit(category.format)}`
                  : "Free"}
              </span>
              <span>
                {approvedCount}
                {category.max_teams !== null && `/${category.max_teams}`}{" "}
                approved
              </span>
              {category.registration_deadline && (
                <span>
                  Closes {shortDeadline(category.registration_deadline)}
                </span>
              )}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {toggling && (
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          )}
          <Switch
            checked={draft.open}
            onCheckedChange={toggleOpen}
            disabled={locked || toggling}
            aria-label={`Accept registrations for ${category.name}`}
          />
        </div>
      </div>

      {!locked && draft.open && !availability.open && (
        <p className="flex items-start gap-2 border-t border-warning/30 bg-warning/10 px-4 py-2.5 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          {CLOSED_MESSAGES[availability.reason]}
        </p>
      )}

      {expanded && (
        <div
          id={`reg-${category.id}`}
          className="space-y-6 border-t border-border bg-muted/20 p-4 sm:p-5"
        >
          {locked && (
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" />
              This category has started, so it no longer takes new entries
              whatever these settings say.
            </p>
          )}

          {/* ---------- who signs up ---------- */}
          <fieldset className="min-w-0 space-y-2.5">
            <legend className="eyebrow mb-2.5 text-primary">Who signs up</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {FORMATS.map((f) => {
                const active = draft.format === f.value;
                return (
                  <label
                    key={f.value}
                    className={cn(
                      "relative flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-3 transition-colors duration-150 has-focus-visible:ring-3 has-focus-visible:ring-ring/50 sm:flex-col sm:gap-2",
                      active
                        ? "border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <input
                      type="radio"
                      name={`format-${category.id}`}
                      value={f.value}
                      checked={active}
                      onChange={() => set("format", f.value)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "grid size-9 shrink-0 place-items-center rounded-lg",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <f.icon className="size-4.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold leading-tight">
                        {FORMAT_LABELS[f.value]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {f.hint}
                      </span>
                    </span>
                    {active && (
                      <Check className="absolute top-3 right-3 size-4 text-primary" />
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* ---------- limits ---------- */}
          <fieldset className="min-w-0 space-y-2.5">
            <legend className="eyebrow mb-2.5 text-primary">Limits</legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`deadline-${category.id}`}>
                  Sign-ups close{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id={`deadline-${category.id}`}
                    type="datetime-local"
                    value={draft.deadline}
                    onChange={(e) => set("deadline", e.target.value)}
                    className="bg-card"
                  />
                  {draft.deadline && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => set("deadline", "")}
                      className="shrink-0"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sign-ups stop on their own at this time.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`max-${category.id}`}>
                  Maximum {unit === "team" ? "teams" : "players"}{" "}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id={`max-${category.id}`}
                  type="number"
                  min={1}
                  placeholder="No limit"
                  inputMode="numeric"
                  value={draft.maxTeams}
                  onChange={(e) => set("maxTeams", e.target.value)}
                  aria-invalid={Boolean(maxProblem)}
                  className="bg-card"
                />
                <p
                  className={cn(
                    "text-xs",
                    maxProblem ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {maxProblem ?? "Only approved entries count toward it."}
                </p>
              </div>
            </div>
          </fieldset>

          {/* ---------- payment ---------- */}
          <fieldset className="min-w-0 space-y-2.5">
            <legend className="eyebrow mb-2.5 text-primary">Payment</legend>
            <div className="space-y-1.5">
              <Label htmlFor={`fee-${category.id}`}>Registration fee</Label>
              <MoneyInput
                id={`fee-${category.id}`}
                value={draft.fee}
                onChange={(v) => set("fee", v)}
                suffix={`per ${unit}`}
                invalid={Boolean(feeProblem)}
              />
              <p
                className={cn(
                  "text-xs",
                  feeProblem ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {feeProblem ?? "Leave at 0 for a free category."}
              </p>
            </div>
            {fee > 0 && (
              <ToggleRow
                id={`upfront-${category.id}`}
                icon={Wallet}
                label="Require proof of payment to register"
                hint="When off, players can pay later from their reference link."
                checked={draft.upfront}
                onChange={(v) => set("upfront", v)}
              />
            )}
          </fieldset>

          {/* ---------- extras ---------- */}
          <fieldset className="min-w-0 space-y-2.5">
            <legend className="eyebrow mb-2.5 text-primary">Extras</legend>
            <ToggleRow
              id={`shirts-${category.id}`}
              icon={Shirt}
              label="Offer t-shirts"
              hint="Players can add a shirt; sizes are asked only if they do."
              checked={draft.shirts}
              onChange={(v) => set("shirts", v)}
            >
              {draft.shirts && (
                <div className="space-y-1.5 border-t border-border pt-3">
                  <Label htmlFor={`shirt-price-${category.id}`}>
                    Shirt price
                  </Label>
                  <MoneyInput
                    id={`shirt-price-${category.id}`}
                    value={draft.shirtPrice}
                    onChange={(v) => set("shirtPrice", v)}
                    suffix="per player"
                    invalid={Boolean(shirtProblem)}
                  />
                  <p
                    className={cn(
                      "text-xs",
                      shirtProblem
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {shirtProblem ??
                      (Number(draft.shirtPrice || 0) > 0
                        ? "Added to the total for each player who takes a shirt."
                        : "Shirts are included at no extra cost.")}
                  </p>
                </div>
              )}
            </ToggleRow>
            <ToggleRow
              id={`id-${category.id}`}
              icon={IdCard}
              label="Require a valid ID photo"
              hint="Each player uploads an ID. It's stored privately."
              checked={draft.needsId}
              onChange={(v) => set("needsId", v)}
            />
          </fieldset>

          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            <span
              aria-live="polite"
              className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground sm:mr-auto"
            >
              {dirty ? (
                "Unsaved changes"
              ) : saved ? (
                <>
                  <Check className="size-4 text-primary" /> Saved
                </>
              ) : null}
            </span>
            {dirty && (
              <Button
                type="button"
                variant="ghost"
                onClick={() =>
                  setDraft((d) => ({ ...draftOf(category), open: d.open }))
                }
                disabled={pending}
              >
                Discard
              </Button>
            )}
            <Button onClick={save} disabled={pending || invalid || !dirty}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function Pill({
  tone,
  children,
}: {
  tone: "ball" | "muted" | "warning";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-heading text-[11px] font-bold uppercase tracking-wider",
        tone === "ball" && "bg-ball text-ball-foreground",
        tone === "muted" && "bg-muted text-muted-foreground",
        tone === "warning" && "bg-warning/15 text-warning",
      )}
    >
      {children}
    </span>
  );
}

/** A peso amount with its unit, e.g. "₱ [ 500 ] per team". */
function MoneyInput({
  id,
  value,
  onChange,
  suffix,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  suffix: string;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-muted-foreground"
      >
        ₱
      </span>
      <Input
        id={id}
        type="number"
        min={0}
        step="1"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.target.value === "0" && e.target.select()}
        aria-invalid={invalid}
        className="bg-card pr-24 pl-7"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
      >
        {suffix}
      </span>
    </div>
  );
}

function ToggleRow({
  id,
  icon: Icon,
  label,
  hint,
  checked,
  onChange,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "grid size-8 shrink-0 place-items-center rounded-lg transition-colors",
              checked ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <Icon className="size-4" />
          </span>
          <div className="min-w-0 space-y-0.5">
            <Label htmlFor={id}>{label}</Label>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
          </div>
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onChange} />
      </div>
      {children}
    </div>
  );
}
