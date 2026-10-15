"use client";

import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoadingOverlay } from "@/components/loading-overlay";
import { TournamentStatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  Check,
  ChevronsUpDown,
  ClipboardList,
  Globe,
  LayoutDashboard,
  Layers,
  ListOrdered,
  Shuffle,
  Trophy,
  Users,
} from "lucide-react";
import type { Category } from "@/types";

/**
 * `scoped`: the page shows one category at a time, so the category picker
 * applies to it. Registrations covers the whole tournament, as does Settings
 * (reached from the header button, not a tab).
 */
const TABS = [
  { seg: "", label: "Overview", icon: LayoutDashboard, scoped: true },
  { seg: "registrations", label: "Registrations", icon: ClipboardList, scoped: false },
  { seg: "participants", label: "Teams", icon: Users, scoped: true },
  { seg: "groups", label: "Seeding & Groups", icon: Shuffle, scoped: true },
  { seg: "group-stage", label: "Group Stage", icon: ListOrdered, scoped: true },
  { seg: "schedule", label: "Schedule", icon: CalendarClock, scoped: true },
  { seg: "finals", label: "Finals", icon: Trophy, scoped: true },
];

/**
 * The workspace's one navigation block, attached to the bottom of the
 * tournament header: first *which category* you are looking at (a picker,
 * styled as a select so it never reads as a second row of tabs), then *which
 * page* (underlined tabs). On pages that cover the whole tournament the
 * picker steps aside and says so.
 *
 * The active category lives in `?category=` (layouts don't receive
 * searchParams), and every tab link carries it along.
 */
export function WorkspaceNav({
  id,
  categories,
}: {
  id: string;
  categories: Category[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);

  const requested = searchParams.get("category");
  const active = categories.find((c) => c.id === requested) ?? categories[0];
  // The picked category shows at once; the URL catches up when the page
  // below has rendered on the server.
  const [shownId, setShownId] = useOptimistic(active?.id ?? null);
  const shown = categories.find((c) => c.id === shownId) ?? active;

  const base = `/dashboard/tournaments/${id}`;
  const query = requested ? `?category=${requested}` : "";
  const tabs = TABS.map((t) => {
    const path = t.seg ? `${base}/${t.seg}` : base;
    return {
      ...t,
      href: `${path}${query}`,
      active: t.seg ? pathname.startsWith(path) : pathname === base,
    };
  });
  const current = tabs.find((t) => t.active);
  const onSettings = pathname.startsWith(`${base}/settings`);
  const scoped = !onSettings && (current?.scoped ?? true);

  // Keep the current tab in view when the strip scrolls sideways on a phone.
  const activeTab = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    activeTab.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  function select(c: Category) {
    if (c.id === shown?.id) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("category", c.id);
    setSwitchingTo(c.name);
    // Inside a transition so `pending` covers the whole navigation — the page
    // below re-renders on the server, which is the part that takes a moment.
    startTransition(() => {
      setShownId(c.id);
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="border-t border-border">
      {pending && switchingTo && (
        <LoadingOverlay
          icon={Layers}
          title="Switching category"
          subtitle={switchingTo}
        />
      )}

      {/* ---------- 1. which category ---------- */}
      {shown && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-muted/40 px-4 py-3 sm:px-6">
          <span className="eyebrow flex items-center gap-1.5">
            <Layers className="size-3.5" aria-hidden />
            Category
          </span>
          {!scoped ? (
            <span className="flex min-h-10 items-center gap-2 text-sm text-muted-foreground">
              <Globe className="size-4" aria-hidden />
              This page covers every category
            </span>
          ) : categories.length === 1 ? (
            <span className="flex min-h-10 items-center gap-2">
              <span className="font-semibold">{shown.name}</span>
              <TournamentStatusBadge status={shown.status} />
            </span>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "flex min-h-11 w-full items-center gap-2.5 rounded-xl border border-border bg-card px-3 text-left shadow-sm outline-none transition-colors duration-150 sm:min-h-10 sm:w-auto sm:min-w-72",
                  "hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:border-primary/60",
                )}
                aria-label={`Category: ${shown.name}. Change category`}
              >
                <span className="min-w-0 flex-1 truncate font-semibold">
                  {shown.name}
                </span>
                <TournamentStatusBadge status={shown.status} />
                <ChevronsUpDown
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="min-w-72 p-1.5">
                <DropdownMenuLabel className="px-2 pt-1 pb-1.5">
                  Switch category
                </DropdownMenuLabel>
                {categories.map((c) => {
                  const isActive = c.id === shown.id;
                  return (
                    <DropdownMenuItem
                      key={c.id}
                      onClick={() => select(c)}
                      className={cn(
                        "min-h-12 gap-3 rounded-lg px-2.5 py-2",
                        isActive && "bg-primary/8",
                      )}
                    >
                      <span className="grid size-4 shrink-0 place-items-center">
                        {isActive && <Check className="size-4 text-primary" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate font-medium",
                            isActive && "text-primary",
                          )}
                        >
                          {c.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {c.event_date
                            ? formatDate(c.event_date)
                            : "No play day yet"}
                        </span>
                      </span>
                      <TournamentStatusBadge status={c.status} />
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* ---------- 2. which page ----------
          Scrolls sideways on a phone. `contain-inline-size` stops the strip's
          full width from leaking into the page's own sizing (a scroll box
          still reports its content as its minimum width otherwise). */}
      <nav
        aria-label="Tournament sections"
        className="no-scrollbar flex overflow-x-auto border-t border-border px-2 contain-inline-size sm:px-4"
      >
        {tabs.map((t) => (
          <Link
            key={t.seg || "overview"}
            ref={t.active ? activeTab : undefined}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={cn(
              "relative flex min-h-12 shrink-0 items-center gap-2 px-3 font-heading text-[0.95rem] font-semibold uppercase tracking-wide transition-colors duration-150 outline-none",
              "focus-visible:bg-muted focus-visible:text-foreground",
              "after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-full after:transition-colors",
              t.active
                ? "text-foreground after:bg-primary"
                : "text-muted-foreground after:bg-transparent hover:text-foreground hover:after:bg-border",
            )}
          >
            <t.icon
              className={cn("size-4", t.active && "text-primary")}
              aria-hidden
            />
            {t.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
