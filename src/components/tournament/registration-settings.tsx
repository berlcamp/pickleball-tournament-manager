"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { registrationAvailability, CLOSED_MESSAGES } from "@/services/registration";
import type { Category, CategoryFormat } from "@/types";
import { ChevronDown, ClipboardList, Lock } from "lucide-react";

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
    <div className="glass space-y-4 rounded-2xl p-6">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <ClipboardList className="size-4 text-primary" />
          Public registration
        </h3>
        <p className="text-sm text-muted-foreground">
          Control what each category collects on the public registration page.
        </p>
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
    </div>
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
  const router = useRouter();
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
  const [needsId, setNeedsId] = useState(category.require_player_id);

  // Once the group stage starts the bracket is fixed, so entries are closed.
  const locked = category.status !== "draft";
  const availability = registrationAvailability(category, approvedCount);

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
        require_player_id: needsId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${category.name} registration updated`);
      router.refresh();
    });
  }

  return (
    <li className="rounded-xl border border-white/10">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{category.name}</span>
          <span className="text-xs text-muted-foreground">
            {category.format === "singles" ? "Singles" : "Doubles"}
            {Number(category.registration_fee) > 0
              ? ` · ₱${Number(category.registration_fee)} per team`
              : " · Free"}
            {category.max_teams !== null &&
              ` · ${approvedCount}/${category.max_teams} approved`}
          </span>
        </span>
        {locked ? (
          <Badge variant="outline" className="shrink-0">
            <Lock className="size-3" /> Locked
          </Badge>
        ) : availability.open ? (
          <Badge className="shrink-0">Open</Badge>
        ) : (
          <Badge variant="secondary" className="shrink-0">
            Closed
          </Badge>
        )}
      </button>

      {expanded && (
        <div className="space-y-4 border-t border-white/10 p-4">
          {locked && (
            <p className="rounded-lg border border-white/10 bg-muted/30 p-2.5 text-xs text-muted-foreground">
              This category&apos;s group stage has started, so it no longer
              accepts new entries regardless of these settings.
            </p>
          )}
          {!locked && !availability.open && (
            <p className="rounded-lg border border-warning/30 bg-warning/5 p-2.5 text-xs text-muted-foreground">
              {CLOSED_MESSAGES[availability.reason]}
            </p>
          )}

          <Toggle
            id={`open-${category.id}`}
            label="Accept registrations"
            hint="Show this category on the public registration page."
            checked={open}
            onChange={setOpen}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Format</Label>
              <Select
                items={[
                  { label: "Doubles (2 players)", value: "doubles" },
                  { label: "Singles (1 player)", value: "singles" },
                ]}
                value={format}
                onValueChange={(v) => setFormat(v as CategoryFormat)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doubles">Doubles (2 players)</SelectItem>
                  <SelectItem value="singles">Singles (1 player)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`fee-${category.id}`}>
                Registration fee (₱ per team)
              </Label>
              <Input
                id={`fee-${category.id}`}
                type="number"
                min={0}
                step="1"
                value={fee}
                onChange={(e) => setFee(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`deadline-${category.id}`}>
                Registration closes (optional)
              </Label>
              <Input
                id={`deadline-${category.id}`}
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`max-${category.id}`}>
                Max teams (optional)
              </Label>
              <Input
                id={`max-${category.id}`}
                type="number"
                min={1}
                placeholder="Unlimited"
                value={maxTeams}
                onChange={(e) => setMaxTeams(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Counts approved teams only.
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-white/10 pt-4">
            <Toggle
              id={`upfront-${category.id}`}
              label="Require proof of payment to register"
              hint="Off: teams can pay later from their reference link."
              checked={upfront}
              onChange={setUpfront}
              disabled={Number(fee || 0) <= 0}
            />
            <Toggle
              id={`shirts-${category.id}`}
              label="Ask for t-shirt sizes"
              hint="Collected per player, for shirt ordering."
              checked={shirts}
              onChange={setShirts}
            />
            <Toggle
              id={`id-${category.id}`}
              label="Require a valid ID photo"
              hint="Each player uploads an ID; stored privately."
              checked={needsId}
              onChange={setNeedsId}
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save"}
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
        "flex items-center justify-between gap-4 rounded-xl border border-white/5 p-3",
        disabled && "opacity-60",
      )}
    >
      <div className="min-w-0">
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
