import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getTournamentContext, resolveActiveCategory } from "@/lib/data";
import { loadSchedule } from "@/lib/tournament-data";
import { roleAtLeast } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/page-header";
import { ScheduleTable } from "@/components/tournament/schedule-table";
import { ClearScheduleButton } from "@/components/tournament/clear-schedule-button";
import { ScheduleSummaryButton } from "@/components/tournament/schedule-summary-button";
import { QrShare } from "@/components/qr-share";
import { ScheduleGeneratorButton } from "@/components/tournament/schedule-generator-button";
import { CalendarClock, Layers, Lock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Schedules — reached from the workspace header, not the tabs. Shows the
 * picked category's matches, or every category's (the whole venue) with
 * `?view=all`, and hosts the schedule generator.
 */
export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string; view?: string }>;
}) {
  const { id } = await params;
  const { category, view } = await searchParams;
  const ctx = await getTournamentContext(id);
  if (!ctx) notFound();
  const active = resolveActiveCategory(ctx.categories, category);
  if (!active) notFound();

  const supabase = await createClient();
  const canManage = roleAtLeast(ctx.role, "admin");
  const showAll = view === "all" && ctx.categories.length > 1;
  const [allRows, groupRows] = await Promise.all([
    // The PDF summary and the "All categories" view span every category.
    loadSchedule(supabase, id),
    canManage
      ? supabase
          .from("groups")
          .select("id, name, category_id")
          .in("category_id", ctx.categories.map((c) => c.id))
          .order("position")
          .then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);
  const rows = showAll
    ? allRows
    : await loadSchedule(supabase, id, active.id);

  // The generator's optional group filter needs each category's groups.
  const groupsByCategory: Record<string, { id: string; name: string }[]> = {};
  for (const g of groupRows) {
    (groupsByCategory[g.category_id] ??= []).push({ id: g.id, name: g.name });
  }

  const base = `/dashboard/tournaments/${id}/schedule?category=${active.id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        description="Who plays where and when. Tap Queue to call a match to its court next."
      >
        {canManage && (
          <ScheduleGeneratorButton
            tournamentId={id}
            categories={ctx.categories}
            groupsByCategory={groupsByCategory}
          />
        )}
        <ScheduleSummaryButton
          rows={allRows}
          tournamentName={ctx.tournament.name}
        />
        <QrShare
          path={`/${ctx.tournament.short_code}/schedule`}
          label="Share schedule"
        />
      </PageHeader>

      {ctx.categories.length > 1 && (
        <nav
          aria-label="Schedule view"
          className="inline-flex max-w-full rounded-xl border border-border bg-card p-1 shadow-card"
        >
          {[
            { href: base, label: active.name, icon: null, on: !showAll },
            { href: `${base}&view=all`, label: "All categories", icon: Layers, on: showAll },
          ].map((v) => (
            <Link
              key={v.label}
              href={v.href}
              aria-current={v.on ? "page" : undefined}
              className={cn(
                "flex min-h-10 min-w-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                v.on
                  ? "bg-court text-court-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {v.icon && <v.icon className="size-4 shrink-0" aria-hidden />}
              <span className="truncate">{v.label}</span>
            </Link>
          ))}
        </nav>
      )}

      {!showAll && canManage && active.status !== "draft" && (
        <div className="glass flex items-start gap-3 rounded-2xl p-4">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Lock className="size-4" />
          </span>
          <div className="text-sm">
            <p className="font-semibold">Times and courts are locked</p>
            <p className="text-muted-foreground">
              {active.name} has started, and players are going by this
              schedule. You can still queue matches below to call teams to
              their court.
            </p>
          </div>
        </div>
      )}

      {!showAll &&
        canManage &&
        active.status === "draft" &&
        rows.length > 0 && (
          <div className="flex justify-end">
            <ClearScheduleButton
              tournamentId={id}
              categoryId={active.id}
              categoryName={active.name}
            />
          </div>
        )}

      {rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No schedule yet"
          description={
            canManage
              ? "Press Generate schedule above to lay out match times and courts. Draw the groups first — the schedule is built from their matches."
              : "Match times and courts haven't been published for this category yet."
          }
        />
      ) : (
        <ScheduleTable
          rows={rows}
          tournamentId={id}
          canQueue={roleAtLeast(ctx.role, "scorekeeper")}
        />
      )}
    </div>
  );
}
