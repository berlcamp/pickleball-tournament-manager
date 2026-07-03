"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eraser, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { clearWinners } from "@/actions/raffle";
import type { RaffleWinner } from "@/types";

interface Props {
  winners: RaffleWinner[];
  raffleId: string;
}

export function WinnersTable({ winners, raffleId }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClearAll() {
    startTransition(async () => {
      const res = await clearWinners({ raffle_id: raffleId });
      if (!res.ok) {
        toast.error("Clear failed", { description: res.error });
        return;
      }
      toast.success(`Removed ${res.data?.deleted ?? 0} winners`);
      setOpen(false);
      router.refresh();
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return winners;
    return winners.filter(
      (w) =>
        w.entry_name.toLowerCase().includes(q) ||
        w.department_name.toLowerCase().includes(q) ||
        (w.entry_designation?.toLowerCase().includes(q) ?? false),
    );
  }, [winners, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {winners.length} {winners.length === 1 ? "winner" : "winners"} drawn
          across all sessions.
        </p>
        {winners.length > 0 ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button variant="outline" size="sm" className="text-destructive">
                  <Eraser className="size-3.5" />
                  Clear all winners
                </Button>
              }
            />
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Clear all winners?</DialogTitle>
                <DialogDescription>
                  This removes all {winners.length} winner records for this
                  raffle. Entries themselves are not affected. This cannot be
                  undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={onClearAll} disabled={pending}>
                  Clear all
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {winners.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h3 className="font-semibold">No winners yet</h3>
          <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="size-3.5" />
            Open the Draw page and spin to record winners.
          </p>
        </div>
      ) : (
        <>
          <Input
            placeholder="Search winners…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-xs"
          />
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Prize</TableHead>
                  <TableHead>Drawn</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {w.draw_index}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 font-medium">
                        <Trophy className="size-3.5 text-amber-500" />
                        {w.entry_name}
                      </span>
                      {w.entry_designation ? (
                        <span className="ml-5 block text-xs text-muted-foreground">
                          {w.entry_designation}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>{w.department_name}</TableCell>
                    <TableCell>
                      {w.prize_label ? (
                        <span className="text-sm">{w.prize_label}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(w.drawn_at), "MMM d, h:mm a")}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                      No matches.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
