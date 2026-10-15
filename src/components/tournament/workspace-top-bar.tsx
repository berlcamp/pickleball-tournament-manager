"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Menu } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The bar above the workspace header: back to the list, your role, and the
 * tournament-wide pages (Registrations, Schedules, Settings) plus the public
 * page. It sticks just under the app header while you scroll, and once it
 * has stuck it also names the tournament, since the big header has scrolled
 * away.
 *
 * Wider screens get a segmented control; a phone gets one Menu button. Each
 * link keeps `?category=` so the category picker stays where it was.
 */
export function WorkspaceTopBar({
  id,
  name,
  shortCode,
  roleLabel,
  canManage,
}: {
  id: string;
  name: string;
  shortCode: string;
  roleLabel: string;
  canManage: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const base = `/dashboard/tournaments/${id}`;

  // A zero-height marker just above the bar: once it scrolls under the app
  // header (64px), the bar is stuck.
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { rootMargin: "-64px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const pages = [
    { seg: "registrations", label: "Registrations" },
    { seg: "schedule", label: "Schedules" },
    ...(canManage ? [{ seg: "settings", label: "Settings" }] : []),
  ].map((p) => {
    const path = `${base}/${p.seg}`;
    return {
      ...p,
      href: category ? `${path}?category=${category}` : path,
      active: pathname.startsWith(path),
    };
  });
  const publicHref = `/${shortCode}`;

  return (
    <>
      <div ref={sentinel} aria-hidden />
      <div
        className={cn(
          "sticky top-16 z-10 -mx-4 flex min-h-14 items-center justify-between gap-3 px-4 py-2 transition-[background-color,box-shadow,border-color] duration-200 sm:-mx-6 sm:px-6",
          stuck
            ? "rounded-b-2xl border-x border-b border-border bg-background/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/75"
            : "border-b border-transparent",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/dashboard"
            aria-label="All tournaments"
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span className={cn(stuck && "hidden sm:inline")}>
              {stuck ? "Tournaments" : "All tournaments"}
            </span>
          </Link>
          {stuck ? (
            <span className="truncate font-heading text-lg font-bold uppercase leading-none tracking-wide">
              {name}
            </span>
          ) : (
            <Badge className="border-0 bg-ball text-ball-foreground">
              {roleLabel}
            </Badge>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Wider screens: a segmented control. */}
          <nav
            aria-label="Tournament"
            className="hidden items-center gap-0.5 rounded-full border border-border bg-card p-1 shadow-sm md:flex"
          >
            {pages.map((p) => (
              <Link
                key={p.seg}
                href={p.href}
                aria-current={p.active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center rounded-full px-3.5 text-sm font-medium transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  p.active
                    ? "bg-court text-court-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {p.label}
              </Link>
            ))}
          </nav>

          {/* Phones: one menu button for the three pages. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium shadow-sm outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted md:hidden"
              aria-label="Tournament menu"
            >
              <Menu className="size-4" aria-hidden />
              {pages.find((p) => p.active)?.label ?? "Menu"}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5">
              {pages.map((p) => (
                <DropdownMenuItem
                  key={p.seg}
                  render={<Link href={p.href} />}
                  className={cn(
                    "min-h-11 rounded-lg px-2.5",
                    p.active && "bg-primary/8 font-semibold text-primary",
                  )}
                >
                  {p.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={<Link href={publicHref} target="_blank" />}
                className="min-h-11 gap-2 rounded-lg px-2.5 font-semibold text-primary"
              >
                Public page
                <ExternalLink className="size-3.5" aria-hidden />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link
            href={publicHref}
            target="_blank"
            className="hidden h-10 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors duration-150 outline-none hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 md:flex"
          >
            Public page
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </>
  );
}
