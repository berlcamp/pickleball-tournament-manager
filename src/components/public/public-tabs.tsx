"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, ClipboardPen, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Portal tabs: a scoreboard-style segmented control that sticks under the
 * header, so a player deep in the standings is one thumb-tap from the
 * schedule. Three equal segments always fit a 375px screen — nothing to
 * scroll sideways. The finals bracket is part of Standings.
 *
 * Registration is the landing tab and lives at the bare `/{code}`, so it
 * matches on an exact pathname rather than a prefix.
 */
export function PublicTabs({ code }: { code: string }) {
  const pathname = usePathname();
  const base = `/${code}`;
  const tabs = [
    { href: base, label: "Register", icon: ClipboardPen, exact: true },
    { href: `${base}/standings`, label: "Standings", icon: ListOrdered },
    { href: `${base}/schedule`, label: "Schedule", icon: CalendarClock },
  ];

  return (
    <div className="sticky top-14 z-30 -mx-4 bg-background/95 px-4 py-2 supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur-md sm:-mx-6 sm:px-6">
      <nav
        aria-label="Tournament sections"
        className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-card p-1 shadow-card"
      >
        {tabs.map((t) => {
          const active = t.exact
            ? pathname === t.href
            : pathname.startsWith(t.href);
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 sm:min-h-11 sm:flex-row sm:gap-2",
                "font-heading text-[0.8125rem] font-semibold uppercase tracking-wide sm:text-[0.95rem]",
                "outline-none transition-[background-color,color,transform] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97]",
                active
                  ? "bg-court text-court-foreground shadow-sm dark:ring-1 dark:ring-ball/40"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon
                className={cn("size-4 shrink-0", active && "text-ball")}
                aria-hidden
              />
              <span className="truncate">{t.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
