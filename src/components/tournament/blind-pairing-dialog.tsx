"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { bulkAddParticipants } from "@/actions/participants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Shuffle } from "lucide-react";
import {
  drawCrossPairs,
  drawSinglePairs,
  parseRoster,
} from "@/services/blindPairing";

type Mode = "single" | "two";

/**
 * Blind pairing: the organiser types the individual players and the draw hands
 * out partners at random — either from one pot, or across two groups so that
 * a team is always one player from each. The teams are only written to the
 * category once the draw is accepted, so an unlucky draw can just be rolled
 * again.
 */
export function BlindPairingDialog({
  tournamentId,
  categoryId,
}: {
  tournamentId: string;
  categoryId: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("single");
  const [rosterA, setRosterA] = useState("");
  const [rosterB, setRosterB] = useState("");
  const [teams, setTeams] = useState<string[][] | null>(null);
  const [unpaired, setUnpaired] = useState<string[]>([]);
  const [pending, startTransition] = useTransition();

  const playersA = useMemo(() => parseRoster(rosterA), [rosterA]);
  // A name typed into both boxes belongs to the group it was listed in first.
  const playersB = useMemo(() => {
    const taken = new Set(playersA.map((p) => p.toLowerCase()));
    return parseRoster(rosterB).filter((p) => !taken.has(p.toLowerCase()));
  }, [rosterB, playersA]);

  const ready =
    mode === "single"
      ? playersA.length >= 2
      : playersA.length >= 1 && playersB.length >= 1;

  function reset() {
    setRosterA("");
    setRosterB("");
    setTeams(null);
    setUnpaired([]);
  }

  function edit(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setTeams(null);
    };
  }

  function draw() {
    if (!ready) return;
    const result =
      mode === "single"
        ? drawSinglePairs(playersA)
        : drawCrossPairs(playersA, playersB);
    setTeams(result.pairs.map(([a, b]) => [a, b]));
    setUnpaired(result.unpaired);
  }

  function save() {
    if (!teams?.length) return;
    startTransition(async () => {
      const res = await bulkAddParticipants(
        tournamentId,
        categoryId,
        teams.map((t) => t.join(" / ")).join("\n"),
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${res.data} teams added`);
      reset();
      setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <Shuffle className="size-4" /> Blind pairing
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Blind pairing</DialogTitle>
          <DialogDescription>
            One player per line. The draw gives everyone a random partner.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-0.5">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
            <ModeButton
              active={mode === "single"}
              onClick={() => {
                setMode("single");
                setTeams(null);
              }}
              label="One group"
              hint="Anyone with anyone"
            />
            <ModeButton
              active={mode === "two"}
              onClick={() => {
                setMode("two");
                setTeams(null);
              }}
              label="Two groups"
              hint="One from each group"
            />
          </div>

          {mode === "single" ? (
            <Roster
              label={`Players (${playersA.length})`}
              placeholder={"Cesar\nHoney\nHizen\nTonix"}
              value={rosterA}
              onChange={edit(setRosterA)}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Roster
                label={`Group A (${playersA.length})`}
                placeholder={"Cesar\nHizen"}
                value={rosterA}
                onChange={edit(setRosterA)}
              />
              <Roster
                label={`Group B (${playersB.length})`}
                placeholder={"Honey\nTonix"}
                value={rosterB}
                onChange={edit(setRosterB)}
              />
            </div>
          )}

          {mode === "two" && (
            <p className="text-xs text-muted-foreground">
              Every team takes one player from each group — two players from the
              same group are never partners.
            </p>
          )}

          {teams && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Draw ({teams.length} teams)
              </label>
              <ul className="divide-y divide-border/50 rounded-xl border border-border/60">
                {teams.map((team, i) => (
                  <li
                    key={team.join("|")}
                    className="flex items-center gap-3 px-3 py-2 text-sm"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-muted text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium">
                      {team.join(" / ")}
                    </span>
                  </li>
                ))}
              </ul>
              {unpaired.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  No partner for {unpaired.join(", ")}
                  {mode === "single"
                    ? " — an odd number of players."
                    : " — the groups are uneven."}{" "}
                  Add another player and draw again, or pair them by hand
                  afterwards.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={draw} disabled={pending || !ready}>
            <Shuffle className="size-4" />{" "}
            {teams ? "Draw again" : "Draw partners"}
          </Button>
          <Button onClick={save} disabled={pending || !teams?.length}>
            {teams?.length ? `Add ${teams.length} teams` : "Add teams"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-lg px-3 py-2 text-left transition-colors",
        active
          ? "bg-background shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <span className="block text-sm font-medium">{label}</span>
      <span className="block text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}

function Roster({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <Textarea
        rows={7}
        className="field-sizing-fixed h-36 resize-none overflow-y-auto"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
