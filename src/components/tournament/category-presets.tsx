"use client";

import { Plus } from "lucide-react";
import { CATEGORY_PRESETS } from "@/lib/constants";

/**
 * One-tap category names, so the common ones never have to be typed on a
 * phone. Names already in use are left out; when every preset is taken the
 * row disappears.
 */
export function CategoryPresets({
  used,
  onPick,
  disabled,
}: {
  used: string[];
  onPick: (name: string) => void;
  disabled?: boolean;
}) {
  const taken = new Set(used.map((n) => n.trim().toLowerCase()));
  const options = CATEGORY_PRESETS.filter((p) => !taken.has(p.toLowerCase()));
  if (options.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Quick add</p>
      <ul className="flex flex-wrap gap-2">
        {options.map((name) => (
          <li key={name}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(name)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium outline-none transition-colors duration-150 hover:border-primary/50 hover:bg-primary/5 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 sm:min-h-8"
            >
              <Plus className="size-3.5 text-primary" aria-hidden />
              {name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
