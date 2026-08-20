"use client";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDeadline } from "@/lib/format";
import type { RegistrationCategory } from "@/components/public/registration-types";
import { ChevronRight, Clock3, Ticket, User, Users } from "lucide-react";

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
 * that decide the choice: division, format, fee, and how much room is left.
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
        const singles = category.format === "singles";
        const Icon = singles ? User : Users;
        const nearlyFull =
          category.slotsRemaining !== null && category.slotsRemaining <= 3;

        return (
          <li key={category.id}>
            <button
              type="button"
              onClick={() => onSelect(category)}
              className={cn(
                "group relative w-full overflow-hidden rounded-2xl border border-border bg-card/80 text-left shadow-lg backdrop-blur-xl",
                "transition-all duration-150 active:scale-[0.985] active:brightness-110",
                "hover:border-primary/50 hover:shadow-2xl",
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
                    <h3 className="text-balance text-base font-bold leading-tight sm:text-lg">
                      {category.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {singles ? "Singles · 1 player" : "Doubles · 2 players"}
                    </p>
                  </div>

                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <ChevronRight className="size-4" />
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-3">
                  {category.fee > 0 ? (
                    <span className="inline-flex items-baseline gap-1.5">
                      <span className="text-xl font-bold">
                        {formatCurrency(category.fee)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        per team
                      </span>
                    </span>
                  ) : (
                    <span className="rounded-full bg-primary/15 px-2.5 py-1 text-sm font-bold text-primary">
                      Free entry
                    </span>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {category.slotsRemaining !== null && (
                      <Chip
                        icon={Ticket}
                        tone={nearlyFull ? "warning" : "muted"}
                      >
                        {category.slotsRemaining} left
                      </Chip>
                    )}
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
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium",
        tone === "warning"
          ? "bg-warning/15 text-warning"
          : "bg-muted/60 text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {children}
    </span>
  );
}
