"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { seg: "", label: "Overview" },
  { seg: "registrations", label: "Registrations" },
  { seg: "participants", label: "Teams" },
  { seg: "seeding", label: "Seeding" },
  { seg: "groups", label: "Groups" },
  { seg: "group-stage", label: "Group Stage" },
  { seg: "schedule", label: "Schedule" },
  { seg: "finals", label: "Finals" },
  { seg: "results", label: "Results" },
];

export function TabNav({ id }: { id: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = `/dashboard/tournaments/${id}`;
  const category = searchParams.get("category");
  const query = category ? `?category=${category}` : "";

  return (
    <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-white/5 pb-px">
      {TABS.map((tab) => {
        const path = tab.seg ? `${base}/${tab.seg}` : base;
        const href = `${path}${query}`;
        const active = tab.seg
          ? pathname.startsWith(path)
          : pathname === base;
        return (
          <Link
            key={tab.seg || "overview"}
            href={href}
            className={cn(
              "shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
