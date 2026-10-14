"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

const TABS = [
  { seg: "", label: "Overview" },
  { seg: "registrations", label: "Registrations" },
  { seg: "participants", label: "Teams" },
  { seg: "groups", label: "Seeding & Groups" },
  { seg: "group-stage", label: "Group Stage" },
  { seg: "schedule", label: "Schedule" },
  { seg: "finals", label: "Finals" },
  { seg: "results", label: "Results" },
  // The settings page itself 404s below admin, so don't advertise the tab.
  { seg: "settings", label: "Settings", adminOnly: true },
];

export function TabNav({
  id,
  canManage = false,
}: {
  id: string;
  canManage?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const base = `/dashboard/tournaments/${id}`;
  const category = searchParams.get("category");
  const query = category ? `?category=${category}` : "";

  const tabs = TABS.filter((tab) => !tab.adminOnly || canManage).map((tab) => {
    const path = tab.seg ? `${base}/${tab.seg}` : base;
    return {
      ...tab,
      href: `${path}${query}`,
      active: tab.seg ? pathname.startsWith(path) : pathname === base,
    };
  });

  const current = tabs.find((tab) => tab.active) ?? tabs[0];

  return (
    <div>
      {/* Mobile: a single full-width dropdown instead of a row that has to be
          scrolled sideways to reach the last tabs. */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "glass flex min-h-12 w-full items-center justify-between gap-2 rounded-xl px-4 py-3",
            "text-sm font-medium outline-none sm:hidden",
          )}
        >
          <span className="font-heading text-base font-semibold uppercase tracking-wide">
            {current?.label}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="sm:hidden">
          {tabs.map((tab) => (
            <DropdownMenuItem
              key={tab.seg || "overview"}
              render={<Link href={tab.href} />}
              className={cn("px-3 py-2.5 text-sm", tab.active && "text-primary")}
            >
              <span className="flex-1">{tab.label}</span>
              {tab.active && <Check className="size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Desktop: the familiar tab strip. */}
      <nav
        aria-label="Tournament sections"
        className="no-scrollbar hidden gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-card sm:flex"
      >
        {tabs.map((tab) => (
          <Link
            key={tab.seg || "overview"}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2 font-heading text-[0.95rem] font-semibold uppercase tracking-wide transition-colors duration-150",
              "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              tab.active
                ? "bg-court text-court-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
