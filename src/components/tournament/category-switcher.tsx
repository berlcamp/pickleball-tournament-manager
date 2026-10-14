"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CategoryPills } from "@/components/category-pills";
import { LoadingOverlay } from "@/components/loading-overlay";
import { TournamentStatusBadge } from "@/components/status-badge";
import { Layers } from "lucide-react";
import type { Category } from "@/types";

/**
 * Switches the active category for the tournament workspace by writing
 * `?category=<id>` while keeping the current tab (pathname). The active category
 * is derived from the URL (defaulting to the first), since layouts don't receive
 * searchParams.
 */
export function CategorySwitcher({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const requested = searchParams.get("category");
  const active = categories.find((c) => c.id === requested) ?? categories[0];
  // The tapped pill lights up at once; the URL catches up when the tab below
  // has rendered on the server.
  const [shownId, setShownId] = useOptimistic(active?.id ?? null);

  if (categories.length === 0 || !active) return null;
  const shown = categories.find((c) => c.id === shownId) ?? active;

  function select(id: string, name: string) {
    if (id === shown.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", id);
    setSwitchingTo(name);
    // Inside a transition so `pending` covers the whole navigation — the tab
    // below re-renders on the server, which is the part that takes a moment.
    startTransition(() => {
      setShownId(id);
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="w-full space-y-2">
      {pending && switchingTo && (
        <LoadingOverlay
          icon={Layers}
          title="Switching category"
          subtitle={switchingTo}
        />
      )}

      <div className="eyebrow flex items-center gap-2">
        <Layers className="size-3.5" />
        Category
        <TournamentStatusBadge status={shown.status} />
      </div>

      <CategoryPills
        options={categories.map((c) => ({ id: c.id, name: c.name }))}
        activeId={shown.id}
        onSelect={select}
      />
    </div>
  );
}
