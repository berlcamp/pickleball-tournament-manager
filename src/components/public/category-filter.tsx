"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Layers } from "lucide-react";
import type { Category } from "@/types";

/**
 * Public category filter for the standings/schedule tabs. Writes `?category=`
 * (or the "all" sentinel when allowed) while keeping the current tab.
 *
 * A row of pills rather than a dropdown: on the portal every category is worth
 * showing at a glance, and one tap switches instead of two.
 */
export function CategoryFilter({
  categories,
  activeId,
  allowAll = false,
  allLabel = "All categories",
}: {
  categories: Category[];
  activeId: string;
  allowAll?: boolean;
  allLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  if (categories.length <= 1 && !allowAll) return null;

  const options = [
    ...(allowAll ? [{ id: "all", name: allLabel }] : []),
    ...categories.map((c) => ({ id: c.id, name: c.name })),
  ];

  function select(id: string, name: string) {
    if (id === activeId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", id);
    setSwitchingTo(name);
    // A search-param change re-renders the tab on the server without hitting a
    // route loading boundary, so the veil is raised here instead.
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="space-y-2">
      {pending && switchingTo && (
        <LoadingOverlay
          icon={Layers}
          title="Switching category"
          subtitle={switchingTo}
        />
      )}

      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Layers className="size-3.5" />
        Category
      </div>

      {/* Scrolls sideways on a phone rather than wrapping into a tall block. */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 py-0.5">
        {options.map((o) => {
          const active = o.id === activeId;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => select(o.id, o.name)}
              disabled={pending}
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
    </div>
  );
}
