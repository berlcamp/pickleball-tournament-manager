"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HEADER_BUTTON } from "@/components/tournament/header-button";


/**
 * Settings sits in the header rather than among the tabs: it is about the
 * tournament as a whole, not a step in running a category. Lit up while you
 * are on it, and it keeps `?category=` so coming back lands where you were.
 */
export function SettingsButton({ id }: { id: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const href = `/dashboard/tournaments/${id}/settings`;
  const category = searchParams.get("category");
  const active = pathname.startsWith(href);

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
        <Settings className="size-4" /> Settings
      </Link>
    </Button>
  );
}
