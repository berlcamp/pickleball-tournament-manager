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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shuffle, UserX, X } from "lucide-react";
import { drawBlindPairs, parseRoster } from "@/services/blindPairing";

/** Placeholder value for the two "cannot partner" dropdowns. */
const NONE = "__none";

/**
 * Blind pairing: the organiser types the individual players, marks anyone who
 * must not end up together, and the draw hands out partners at random. The
 * teams are only written to the category once the draw is accepted, so an
 * unlucky draw can just be rolled again.
 */
export function BlindPairingDialog({
  tournamentId,
  categoryId,
}: {
  tournamentId: string;
  categoryId: string;
}) {
  const [open, setOpen] = useState(false);
  const [roster, setRoster] = useState("");
  const [restrictions, setRestrictions] = useState<[string, string][]>([]);
  const [left, setLeft] = useState(NONE);
  const [right, setRight] = useState(NONE);
  const [teams, setTeams] = useState<string[][] | null>(null);
  const [unpaired, setUnpaired] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const players = useMemo(() => parseRoster(roster), [roster]);

  function reset() {
    setRoster("");
    setRestrictions([]);
    setLeft(NONE);
    setRight(NONE);
    setTeams(null);
    setUnpaired(null);
  }

  function addRestriction() {
    if (left === NONE || right === NONE || left === right) return;
    const exists = restrictions.some(
      ([a, b]) =>
        (a === left && b === right) || (a === right && b === left),
    );
    if (!exists) setRestrictions([...restrictions, [left, right]]);
    setLeft(NONE);
    setRight(NONE);
  }

  function draw() {
    if (players.length < 2) {
      toast.error("Enter at least two players.");
      return;
    }
    // Restrictions naming players who were since deleted from the roster are
    // simply ignored by the draw, so no need to prune them here.
    const result = drawBlindPairs(players, restrictions);
    if (!result) {
      toast.error(
        "No draw fits those restrictions. Remove one and try again.",
      );
      return;
    }
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
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Players ({players.length})
            </label>
            <Textarea
              rows={7}
              className="field-sizing-fixed h-36 resize-none overflow-y-auto"
              placeholder={"Cesar\nHoney\nHizen\nTonix"}
              value={roster}
              onChange={(e) => {
                setRoster(e.target.value);
                setTeams(null);
              }}
            />
          </div>

          <div className="space-y-2 rounded-xl border border-border/60 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <UserX className="size-3.5" /> Cannot partner together
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <PlayerSelect
                players={players}
                value={left}
                onChange={setLeft}
                label="First player"
              />
              <PlayerSelect
                players={players}
                value={right}
                onChange={setRight}
                label="Second player"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={addRestriction}
                disabled={left === NONE || right === NONE || left === right}
              >
                Add
              </Button>
            </div>
            {restrictions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nobody is barred yet — every partner is possible.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {restrictions.map(([a, b]) => (
                  <li
                    key={`${a}|${b}`}
                    className="flex items-center gap-1 rounded-lg bg-muted px-2 py-1 text-xs"
                  >
                    <span className="font-medium">
                      {a} <span className="text-muted-foreground">✕</span> {b}
                    </span>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() =>
                        setRestrictions(
                          restrictions.filter(([x, y]) => !(x === a && y === b)),
                        )
                      }
                      aria-label={`Allow ${a} and ${b} to partner`}
                    >
                      <X className="size-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
              {unpaired && (
                <p className="text-xs text-muted-foreground">
                  {unpaired} drew no partner — an odd number of players. Add one
                  more and draw again, or pair them by hand afterwards.
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={draw}
            disabled={pending || players.length < 2}
          >
            <Shuffle className="size-4" /> {teams ? "Draw again" : "Draw partners"}
          </Button>
          <Button onClick={save} disabled={pending || !teams?.length}>
            {teams?.length ? `Add ${teams.length} teams` : "Add teams"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlayerSelect({
  players,
  value,
  onChange,
  label,
}: {
  players: string[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const items = [
    { label, value: NONE },
    ...players.map((p) => ({ label: p, value: p })),
  ];
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(v) => onChange(String(v))}
      disabled={players.length < 2}
    >
      <SelectTrigger size="sm" className="w-full flex-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
