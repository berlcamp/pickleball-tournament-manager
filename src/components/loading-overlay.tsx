import { cn } from "@/lib/utils";

/**
 * The full-screen "working on it" veil, shared by every navigation in the app:
 * route loading fallbacks (`loading.tsx`) and the category switchers, which
 * only change a search param and so need to raise it themselves.
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
      className={cn(
        "fixed inset-0 z-50 grid animate-in place-items-center bg-background/70 p-6 backdrop-blur-sm fade-in duration-200",
        className,
      )}
    >
      <div className="glass-strong flex w-full max-w-xs animate-in flex-col items-center gap-4 rounded-2xl px-8 py-8 text-center fade-in zoom-in-95 duration-200">
        <span className="relative grid size-14 place-items-center">
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          {Icon ? (
            <Icon className="size-6 text-primary" />
          ) : (
            <span className="size-2.5 animate-pulse rounded-full bg-primary" />
          )}
        </span>
        <div>
          <p className="font-semibold">{title}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
