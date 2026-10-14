import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Checkout-style stepper for public registration: every step named, finished
 * ones ticked, the current one on court green. `current` is zero-based.
 */
export function StepProgress({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol
      aria-label={`Registration progress: step ${current + 1} of ${steps.length}`}
      className="flex items-start"
    >
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center gap-1.5 text-center"
          >
            {/* Connector to the previous step. */}
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-4 right-1/2 h-0.5 w-full -translate-y-1/2",
                  i <= current ? "bg-primary" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "scoreboard relative z-10 grid size-8 place-items-center rounded-full text-sm font-bold transition-colors duration-150",
                done && "bg-primary text-primary-foreground",
                active &&
                  "bg-court text-court-foreground ring-2 ring-ball ring-offset-2 ring-offset-background",
                !done && !active && "border border-border bg-card text-muted-foreground",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                "font-heading text-xs font-semibold uppercase tracking-wide",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
              {done && <span className="sr-only"> (done)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
