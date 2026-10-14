import { notFound } from "next/navigation";
import Link from "next/link";
import { getTournamentContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { TabNav } from "@/components/tournament/tab-nav";
import { CategorySwitcher } from "@/components/tournament/category-switcher";
import { ScheduleGeneratorButton } from "@/components/tournament/schedule-generator-button";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS, roleAtLeast } from "@/lib/constants";
import { ExternalLink, MapPin, Calendar, QrCode } from "lucide-react";
import { formatDate } from "@/lib/format";

export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getTournamentContext(id);
  if (!ctx) notFound();
  const { tournament: t, role, categories } = ctx;
  const canManage = roleAtLeast(role, "admin");

  // The generator's group filter needs each category's groups. One query for
  // the whole tournament, since the header doesn't know the active category.
  const groupsByCategory: Record<string, { id: string; name: string }[]> = {};
  if (canManage && categories.length > 0) {
    const supabase = await createClient();
    const { data: groupRows } = await supabase
      .from("groups")
      .select("id, name, category_id")
      .in("category_id", categories.map((c) => c.id))
      .order("position");
    for (const g of groupRows ?? []) {
      (groupsByCategory[g.category_id] ??= []).push({ id: g.id, name: g.name });
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="relative isolate bg-court text-court-foreground">
          {t.banner ? (
            <>
              <div
                className="absolute inset-0 -z-10 bg-cover bg-center opacity-35"
                style={{ backgroundImage: `url(${t.banner})` }}
                aria-hidden
              />
              <div
                className="absolute inset-0 -z-10 bg-gradient-to-t from-court via-court/80 to-court/30"
                aria-hidden
              />
            </>
          ) : (
            <div className="bg-court-lines absolute inset-0 -z-10" aria-hidden />
          )}
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Link
                  href="/dashboard"
                  className="rounded text-sm text-court-foreground/75 outline-none hover:text-court-foreground focus-visible:ring-2 focus-visible:ring-ball"
                >
                  ← All tournaments
                </Link>
                <Badge className="border-0 bg-ball text-ball-foreground">
                  {ROLE_LABELS[role]}
                </Badge>
              </div>
              <h1 className="text-balance text-3xl font-bold uppercase leading-[0.95] sm:text-5xl">
                {t.name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-court-foreground/80">
                <span className="flex items-center gap-1.5">
                  <Calendar className="size-4" /> {formatDate(t.start_date)}
                </span>
                {t.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" /> {t.location}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && (
                <ScheduleGeneratorButton
                  tournamentId={id}
                  categories={categories}
                  groupsByCategory={groupsByCategory}
                />
              )}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-court-foreground/25 bg-court-foreground/10 text-court-foreground hover:bg-court-foreground/20 hover:text-court-foreground dark:border-court-foreground/25 dark:bg-court-foreground/10"
              >
                <Link href={`/${t.short_code}`} target="_blank">
                  <ExternalLink className="size-4" /> Public page
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="border-court-foreground/25 bg-court-foreground/10 text-court-foreground hover:bg-court-foreground/20 hover:text-court-foreground dark:border-court-foreground/25 dark:bg-court-foreground/10"
              >
                <Link href={`/qr/${t.short_code}`} target="_blank">
                  <QrCode className="size-4" /> QR code
                </Link>
              </Button>
            </div>
          </div>
        </div>
        {categories.length > 0 && (
          <div className="border-t border-border p-4 sm:px-6">
            <CategorySwitcher categories={categories} />
          </div>
        )}
      </section>

      <TabNav id={id} canManage={canManage} />

      <div>{children}</div>
    </div>
  );
}
