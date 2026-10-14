import { cn } from "@/lib/utils";

/**
 * The "nothing here yet" card used across the portal: an icon in a court-green
 * tile, a condensed headline and one line of what to expect.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass flex flex-col items-center gap-3 rounded-2xl px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid size-12 place-items-center rounded-2xl bg-court text-ball">
        <Icon className="size-6" />
      </span>
      <h2 className="text-xl font-bold uppercase leading-tight tracking-wide">
        {title}
      </h2>
      {children && (
        <div className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
      )}
    </div>
  );
}
