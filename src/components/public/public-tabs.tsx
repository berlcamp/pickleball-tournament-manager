"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function PublicTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/tournament/${slug}`;
  const tabs = [
    { href: `${base}/standings`, label: "Standings" },
    { href: `${base}/schedule`, label: "Schedule" },
    { href: `${base}/finals`, label: "Finals" },
  ];
  return (
    <div className="flex gap-1 border-b border-white/5">
      {tabs.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors",
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
