"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  if (categories.length <= 1 && !allowAll) return null;

  function select(id: string | null) {
    if (!id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <Layers className="size-4 text-muted-foreground" />
      <Select
        items={[
          ...(allowAll ? [{ label: allLabel, value: "all" }] : []),
          ...categories.map((c) => ({ label: c.name, value: c.id })),
        ]}
        value={activeId}
        onValueChange={select}
      >
        <SelectTrigger className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowAll && <SelectItem value="all">{allLabel}</SelectItem>}
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
