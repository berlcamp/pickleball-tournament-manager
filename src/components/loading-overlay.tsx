import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The "working on it" signal shared by every navigation in the app: route
 * loading fallbacks (`loading.tsx`) and the category switchers, which only
 * change a search param and so need to raise it themselves.
 *
 * It used to be a full-screen frosted veil. That blocked the page and made
 * every wait feel longer than it was, so it is now a thin bar along the top
 * edge plus a small status pill — the page stays visible and readable.
 */
export function LoadingOverlay({
  title = "Loading…",
  subtitle,
  icon: Icon,
  className,
}: {
  title?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("pointer-events-none fixed inset-x-0 top-0 z-50", className)}
    >
      <div className="h-0.5 w-full overflow-hidden bg-primary/15">
        <div className="h-full w-1/3 animate-[loading-bar_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
      <div className="flex justify-center pt-3">
        <div className="glass-strong flex animate-in items-center gap-2.5 rounded-full py-1.5 pr-4 pl-2 text-sm fade-in slide-in-from-top-2 duration-200">
          <span className="relative grid size-6 place-items-center">
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
            {Icon && <Icon className="size-3 text-primary" />}
          </span>
          <span className="font-medium">{title}</span>
          {subtitle && (
            <span className="max-w-[40vw] truncate text-muted-foreground">
              {subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Placeholder blocks shaped like a typical workspace page — a heading and a
 * couple of cards — shown under the loading bar while the server renders.
 */
export function PageSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-80 max-w-full rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
