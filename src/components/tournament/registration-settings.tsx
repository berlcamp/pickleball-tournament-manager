"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCategoryRegistration } from "@/actions/registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import {
  registrationAvailability,
  CLOSED_MESSAGES,
  feeUnit,
} from "@/services/registration";
import { FORMAT_LABELS } from "@/lib/constants";
import type { Category, CategoryFormat } from "@/types";
import { Check, ChevronDown, ClipboardList, Loader2, Lock } from "lucide-react";

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
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <ClipboardList className="size-5" />
        </span>
        <div>
          <h2 className="font-heading text-2xl font-bold">
            Public registration
          </h2>
          <p className="text-sm text-muted-foreground">
            Let teams sign up from your public page. Tap a category to open
            it, set the fee, and choose what to collect.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
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
  const [expanded, setExpanded] = useState(false);

  const [format, setFormat] = useState<CategoryFormat>(category.format);
  const [open, setOpen] = useState(category.registration_open);
  const [deadline, setDeadline] = useState(
    toLocalInput(category.registration_deadline),
  );
  const [maxTeams, setMaxTeams] = useState(
    category.max_teams === null ? "" : String(category.max_teams),
  );
  const [fee, setFee] = useState(String(Number(category.registration_fee)));
  const [upfront, setUpfront] = useState(category.require_payment_upfront);
  const [shirts, setShirts] = useState(category.collect_shirt_sizes);
  const [shirtPrice, setShirtPrice] = useState(
    String(Number(category.shirt_price)),
  );
  const [needsId, setNeedsId] = useState(category.require_player_id);
  const [saved, setSaved] = useState(false);

  // Once the group stage starts the bracket is fixed, so entries are closed.
  const locked = category.status !== "draft";
  const availability = registrationAvailability(category, approvedCount);

  // Caught here so the problem shows beside the field, not as a toast after
  // the round trip.
  const feeProblem = Number(fee || 0) < 0 ? "The fee can't be negative." : null;
  const maxProblem =
    maxTeams !== "" && (!Number.isInteger(Number(maxTeams)) || Number(maxTeams) < 1)
      ? "Use a whole number of at least 1, or leave it empty."
      : null;
  const shirtProblem =
    Number(shirtPrice || 0) < 0 ? "The price can't be negative." : null;
  const invalid = Boolean(feeProblem || maxProblem || shirtProblem);
  // Any edit after a save takes the "Saved" mark away again.
  function edit<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setSaved(false);
    };
  }

  function save() {
    startTransition(async () => {
      const res = await updateCategoryRegistration(tournamentId, category.id, {
        format,
        registration_open: open,
        // Convert here, in the manager's browser: `datetime-local` carries no
        // zone, and the server runs in UTC.
        registration_deadline: deadline
          ? new Date(deadline).toISOString()
          : "",
        max_teams: maxTeams === "" ? "" : Number(maxTeams),
        registration_fee: Number(fee || 0),
        require_payment_upfront: upfront,
        collect_shirt_sizes: shirts,
        shirt_price: Number(shirtPrice || 0),
        require_player_id: needsId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${category.name} registration updated`);
      setSaved(true);
    });
  }

  return (
    <li className="overflow-hidden rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex min-h-14 w-full items-center gap-3 p-3 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-heading text-lg font-bold leading-tight">
            {category.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {FORMAT_LABELS[category.format]}
            {Number(category.registration_fee) > 0
              ? ` · ₱${Number(category.registration_fee)} per ${feeUnit(category.format)}`
              : " · Free"}
            {category.max_teams !== null &&
              ` · ${approvedCount}/${category.max_teams} approved`}
          </span>
        </span>
        {locked ? (
          <Badge className="shrink-0 border-0 bg-muted text-muted-foreground">
            <Lock className="size-3" /> Locked
          </Badge>
        ) : availability.open ? (
          <Badge className="shrink-0 border-0 bg-ball text-ball-foreground">
            Open
          </Badge>
        ) : (
          <Badge className="shrink-0 border-0 bg-muted text-muted-foreground">
            Closed
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-border bg-muted/20 p-4">
          {locked && (
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <Lock className="mt-0.5 size-4 shrink-0" />
              This category&apos;s group stage has started, so it no longer
              accepts new entries regardless of these settings.
            </p>
          )}
          {!locked && !availability.open && (
            <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-foreground">
              {CLOSED_MESSAGES[availability.reason]}
            </p>
          )}

          <Toggle
            id={`open-${category.id}`}
            label="Accept registrations"
            hint="Show this category on the public registration page."
            checked={open}
            onChange={edit(setOpen)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select
                items={[
                  { label: "Doubles (2 players)", value: "doubles" },
                  { label: "Singles (1 player)", value: "singles" },
                  { label: "Blind pairing (1 player)", value: "blind_pairing" },
                ]}
                value={format}
                onValueChange={(v) => edit(setFormat)(v as CategoryFormat)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doubles">Doubles (2 players)</SelectItem>
                  <SelectItem value="singles">Singles (1 player)</SelectItem>
                  <SelectItem value="blind_pairing">
                    Blind pairing (1 player)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`fee-${category.id}`}>
                Registration fee (₱ per {feeUnit(format)})
              </Label>
              <Input
                id={`fee-${category.id}`}
                type="number"
                min={0}
                step="1"
                inputMode="numeric"
                value={fee}
                onChange={(e) => edit(setFee)(e.target.value)}
                aria-invalid={Boolean(feeProblem)}
              />
              <p
                className={cn(
                  "text-xs",
                  feeProblem ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {feeProblem ?? "Use 0 for a free category."}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`deadline-${category.id}`}>
                Registration closes{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`deadline-${category.id}`}
                type="datetime-local"
                value={deadline}
                onChange={(e) => edit(setDeadline)(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Sign-ups stop on their own at this time.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`max-${category.id}`}>
                Max teams{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`max-${category.id}`}
                type="number"
                min={1}
                placeholder="Unlimited"
                inputMode="numeric"
                value={maxTeams}
                onChange={(e) => edit(setMaxTeams)(e.target.value)}
                aria-invalid={Boolean(maxProblem)}
              />
              <p
                className={cn(
                  "text-xs",
                  maxProblem ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {maxProblem ?? "Counts approved teams only."}
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <Toggle
              id={`upfront-${category.id}`}
              label="Require proof of payment to register"
              hint="Off: teams can pay later from their reference link."
              checked={upfront}
              onChange={edit(setUpfront)}
              disabled={Number(fee || 0) <= 0}
            />
            <Toggle
              id={`shirts-${category.id}`}
              label="Offer t-shirts"
              hint="Registrants can add a shirt for each player; sizes are asked only if they do."
              checked={shirts}
              onChange={edit(setShirts)}
            />
            {shirts && (
              <div className="space-y-1.5 rounded-xl border border-border bg-card p-3">
                <Label htmlFor={`shirt-price-${category.id}`}>
                  T-shirt price (₱ per player)
                </Label>
                <Input
                  id={`shirt-price-${category.id}`}
                  type="number"
                  min={0}
                  step="1"
                  inputMode="numeric"
                  value={shirtPrice}
                  onChange={(e) => edit(setShirtPrice)(e.target.value)}
                  aria-invalid={Boolean(shirtProblem)}
                />
                <p
                  className={cn(
                    "text-xs",
                    shirtProblem ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {shirtProblem
                    ? shirtProblem
                    : Number(shirtPrice || 0) > 0
                    ? `Added to the registration for each player who takes a shirt — ${formatCurrency(Number(shirtPrice))} per player.`
                    : "Shirts are included at no extra cost."}
                </p>
              </div>
            )}
            <Toggle
              id={`id-${category.id}`}
              label="Require a valid ID photo"
              hint="Each player uploads an ID; stored privately."
              checked={needsId}
              onChange={edit(setNeedsId)}
            />
          </div>

          <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
            <span
              aria-live="polite"
              className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground"
            >
              {saved && (
                <>
                  <Check className="size-4 text-primary" /> Saved
                </>
              )}
            </span>
            <Button onClick={save} disabled={pending || invalid}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {pending ? "Saving…" : `Save ${category.name}`}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function Toggle({
  id,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-h-14 items-center justify-between gap-4 rounded-xl border border-border bg-card p-3",
        disabled && "opacity-60",
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id}>{label}</Label>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
