"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Portal tabs. Registration is the landing tab and lives at the bare
 * `/{code}`, so it matches on an exact pathname rather than a prefix.
 */
export function PublicTabs({ code }: { code: string }) {
  const pathname = usePathname();
  const base = `/${code}`;
  const tabs = [
    { href: base, label: "Registration", exact: true },
    { href: `${base}/standings`, label: "Standings" },
    { href: `${base}/schedule`, label: "Schedule" },
    { href: `${base}/finals`, label: "Finals" },
  ];

  return (
    <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto border-b border-white/5 px-1">
      {tabs.map((t) => {
        const active = t.exact
          ? pathname === t.href
          : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
