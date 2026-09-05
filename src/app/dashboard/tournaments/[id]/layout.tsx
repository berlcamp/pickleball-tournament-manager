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
    <div className="space-y-6">
      <div className="glass overflow-hidden rounded-2xl">
        <div
          className="h-28 bg-gradient-to-br from-primary/30 via-chart-2/20 to-transparent"
          style={
            t.banner
              ? {
                  backgroundImage: `url(${t.banner})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : undefined
          }
        />
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{t.name}</h1>
              <Badge variant="secondary">{ROLE_LABELS[role]}</Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
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
            <Button asChild variant="outline" size="sm">
              <Link href={`/${t.short_code}`} target="_blank">
                <ExternalLink className="size-4" /> Public page
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={`/qr/${t.short_code}`} target="_blank">
                <QrCode className="size-4" /> Open QR
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CategorySwitcher categories={categories} />
      </div>

      <TabNav id={id} canManage={canManage} />

      <div>{children}</div>
    </div>
  );
}
