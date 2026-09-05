"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CategoryPills } from "@/components/category-pills";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Layers } from "lucide-react";
import type { Category } from "@/types";

/**
 * Public category filter for the standings/schedule tabs. Writes `?category=`
 * (or the "all" sentinel when allowed) while keeping the current tab.
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

      <CategoryPills
        options={options}
        activeId={activeId}
        disabled={pending}
        onSelect={select}
      />
    </div>
  );
}
