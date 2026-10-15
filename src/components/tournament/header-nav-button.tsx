"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { CalendarClock, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HEADER_BUTTON } from "@/components/tournament/header-button";

// Icons are picked by name: a server component can't pass a component
// function across to a client one.
const ICONS = { schedule: CalendarClock, settings: Settings };

/**
 * A page reached from the workspace header rather than the tabs — Schedules
 * and Settings. Lit up while you are on it, and it keeps `?category=` so the
 * category picker stays where you left it.
 */
export function HeaderNavButton({
  id,
  seg,
  label,
  icon,
}: {
  id: string;
  seg: string;
  label: string;
  icon: keyof typeof ICONS;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = `/dashboard/tournaments/${id}/${seg}`;
  const category = searchParams.get("category");
  const active = pathname.startsWith(href);
  const Icon = ICONS[icon];

  return (
    <Button
      asChild
      variant="outline"
      size="sm"
      className={cn(
        HEADER_BUTTON,
        active &&
          "border-ball/60 bg-court-foreground/20 dark:border-ball/60 dark:bg-court-foreground/20",
      )}
    >
      <Link
        href={category ? `${href}?category=${category}` : href}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="size-4" /> {label}
      </Link>
    </Button>
  );
}
