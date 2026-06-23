"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  if (categories.length === 0) return null;

  const requested = searchParams.get("category");
  const active =
    categories.find((c) => c.id === requested) ?? categories[0];

  function select(id: string | null) {
    if (!id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Layers className="size-4 text-muted-foreground" />
      <Select
        items={categories.map((c) => ({ label: c.name, value: c.id }))}
        value={active.id}
        onValueChange={select}
      >
        <SelectTrigger className="min-w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <TournamentStatusBadge status={active.status} />
    </div>
  );
}
