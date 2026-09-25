"use client";

import { useState, type ReactNode } from "react";
import { Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DrawSettings = {
  totalWinners: number;
  spinDurationSeconds: number;
  departmentId: "ALL" | string;
  prizeLabel: string;
  autoSpin: boolean;
  autoSpinIntervalSeconds: number;
  // When true, paddles hide names during the spin and the landed paddle teases
  // the designation for a beat before revealing the winner's name.
  designationSuspense: boolean;
};

interface Props {
  settings: DrawSettings;
  onChange: (next: DrawSettings) => void;
  departments: { id: string; name: string }[];
  trigger: ReactNode;
}

const DEPT_ALL = "ALL";

export function SettingsDialog({ settings, onChange, departments, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(settings);

  function onOpenChange(next: boolean) {
    if (next) setDraft(settings);
    setOpen(next);
  }

  function save() {
    onChange(draft);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Draw settings</DialogTitle>
          <DialogDescription>
            Configure how the next draw runs. Settings apply to this browser
            session only.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
          <div className="space-y-1.5">
            <Label htmlFor="total-winners">Winners per batch</Label>
            <Input
              id="total-winners"
              type="number"
              min={1}
              max={500}
              value={draft.totalWinners}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  totalWinners: Math.max(1, Math.min(500, Number(e.target.value) || 1)),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              After this many winners, the next spin starts a new batch.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="spin-duration">Spin duration (seconds)</Label>
            <Input
              id="spin-duration"
              type="number"
              min={2}
              max={15}
              step={0.5}
              value={draft.spinDurationSeconds}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  spinDurationSeconds: Math.max(2, Math.min(15, Number(e.target.value) || 4)),
                }))
              }
            />
            <p className="text-xs text-muted-foreground">
              How long the wheel spins before landing.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select
              value={draft.departmentId}
              onValueChange={(v) =>
                setDraft((d) => ({ ...d, departmentId: v as "ALL" | string }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(v: string | null) => {
                    if (!v || v === DEPT_ALL) return "All departments";
                    return departments.find((dep) => dep.id === v)?.name ?? "—";
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEPT_ALL}>All departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Pick a single department to draw from, or leave on All.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="prize-label">Prize label (optional)</Label>
            <Input
              id="prize-label"
              placeholder="e.g. Paddle Set"
              value={draft.prizeLabel}
              onChange={(e) => setDraft((d) => ({ ...d, prizeLabel: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Saved with each winner record.
            </p>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <Label htmlFor="designation-suspense" className="cursor-pointer">
                  Suspense reveal with designation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Hide names during the spin and tease the designation for ~3s
                  before showing the winner.
                </p>
              </div>
              <Switch
                id="designation-suspense"
                checked={draft.designationSuspense}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, designationSuspense: v === true }))
                }
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/30 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col">
                <Label htmlFor="auto-spin" className="cursor-pointer">
                  Auto-spin for multi-winner draws
                </Label>
                <p className="text-xs text-muted-foreground">
                  When more than 1 winner is configured, the next spin triggers
                  automatically after the interval below.
                </p>
              </div>
              <Switch
                id="auto-spin"
                checked={draft.autoSpin}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, autoSpin: v === true }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="auto-spin-interval">Interval between spins (seconds)</Label>
              <Input
                id="auto-spin-interval"
                type="number"
                min={1}
                max={60}
                step={0.5}
                disabled={!draft.autoSpin}
                value={draft.autoSpinIntervalSeconds}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    autoSpinIntervalSeconds: Math.max(1, Math.min(60, Number(e.target.value) || 3)),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Pause after a winner lands before the next spin starts.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={save}>
            <Save className="size-4" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
