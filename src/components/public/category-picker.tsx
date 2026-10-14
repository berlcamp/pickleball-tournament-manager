"use client";

import { cn } from "@/lib/utils";
import { FORMAT_DESCRIPTIONS } from "@/lib/constants";
import { feePerPlayer } from "@/services/registration";
import { formatCurrency, formatDate, formatDeadline } from "@/lib/format";
import type { RegistrationCategory } from "@/components/public/registration-types";
import { CalendarDays, ChevronRight, Clock3, User, Users } from "lucide-react";

/**
 * Rotating accent colours so a stack of categories stays scannable on a phone,
 * where only one or two cards are visible at a time.
 */
const ACCENTS = [
  { bar: "bg-chart-1", tint: "bg-chart-1/15 text-chart-1" },
  { bar: "bg-chart-2", tint: "bg-chart-2/15 text-chart-2" },
  { bar: "bg-chart-3", tint: "bg-chart-3/15 text-chart-3" },
  { bar: "bg-chart-5", tint: "bg-chart-5/15 text-chart-5" },
];

/**
 * Step one of registration: choose a category.
 *
 * Only categories currently accepting entries are passed in, so every card is
 * tappable — no disabled states to read past. Each card leads with the things
 * that decide the choice: division, format, the day it is played, and fee.
 */
export function CategoryPicker({
  categories,
  onSelect,
}: {
  categories: RegistrationCategory[];
  onSelect: (category: RegistrationCategory) => void;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {categories.map((category, index) => {
        const accent = ACCENTS[index % ACCENTS.length];
        const Icon = category.format === "doubles" ? Users : User;

        return (
          <li key={category.id}>
            <button
              type="button"
              onClick={() => onSelect(category)}
              className={cn(
                "group relative w-full overflow-hidden rounded-2xl border border-border bg-card text-left shadow-card",
                "transition-[border-color,box-shadow,transform] duration-150 active:scale-[0.985]",
                "hover:border-primary/50 hover:shadow-raised",
                "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              )}
            >
              {/* Always-on accent stripe: the card reads as tappable without
                  relying on hover, which phones don't have. */}
              <span
                aria-hidden
                className={cn("absolute inset-y-0 left-0 w-1.5", accent.bar)}
              />

              <div className="space-y-3 py-4 pl-5 pr-4 sm:pl-6 sm:pr-5">
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-xl",
                      accent.tint,
                    )}
                  >
                    <Icon className="size-5" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-balance font-heading text-xl font-bold uppercase leading-none tracking-wide">
                      {category.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {FORMAT_DESCRIPTIONS[category.format]}
                    </p>
                    {category.eventDate && (
                      <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <CalendarDays className="size-3.5 shrink-0 text-primary" />
                        {formatDate(category.eventDate)}
                      </p>
                    )}
                  </div>

                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 group-hover:translate-x-0.5">
                    <ChevronRight className="size-5" aria-hidden />
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
                  {category.fee > 0 ? (
                    <span className="inline-flex items-baseline gap-1.5">
                      <span className="scoreboard text-2xl font-bold leading-none">
                        {formatCurrency(
                          feePerPlayer(category.fee, category.format),
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        per player
                      </span>
                    </span>
                  ) : (
                    <span className="rounded-full bg-primary/12 px-2.5 py-1 font-heading text-sm font-bold uppercase tracking-wide text-primary">
                      Free entry
                    </span>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {category.deadline && (
                      <Chip icon={Clock3} tone="muted">
                        <span suppressHydrationWarning>
                          Closes {formatDeadline(category.deadline)}
                        </span>
                      </Chip>
                    )}
                  </div>
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Chip({
  icon: Icon,
  tone,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "muted" | "warning";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        tone === "warning"
          ? "bg-warning/15 text-warning"
          : "bg-muted text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {children}
    </span>
  );
}
