import { cn } from "@/lib/utils";

/**
 * The category row shared by the dashboard switcher and the public filter: one
 * pill per category, the active one filled. Scrolls sideways on a phone rather
 * than wrapping into a tall block.
 */
export function CategoryPills({
  options,
  activeId,
  disabled = false,
  onSelect,
}: {
  options: { id: string; name: string }[];
  activeId: string;
  disabled?: boolean;
  onSelect: (id: string, name: string) => void;
}) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
      {options.map((o) => {
        const active = o.id === activeId;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id, o.name)}
            disabled={disabled}
            aria-current={active ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all",
              "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              "disabled:opacity-60",
              active
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                : "glass text-muted-foreground hover:border-primary/50 hover:text-foreground active:scale-[0.97]",
            )}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}
