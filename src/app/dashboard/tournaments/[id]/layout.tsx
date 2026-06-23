import { notFound } from "next/navigation";
import Link from "next/link";
import { getTournamentContext } from "@/lib/data";
import { TabNav } from "@/components/tournament/tab-nav";
import { CategorySwitcher } from "@/components/tournament/category-switcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABELS } from "@/lib/constants";
import { ExternalLink, MapPin, Calendar } from "lucide-react";
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
          <Button asChild variant="outline" size="sm">
            <Link href={`/tournament/${t.slug}/standings`} target="_blank">
              <ExternalLink className="size-4" /> Public page
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CategorySwitcher categories={categories} />
      </div>

      <TabNav id={id} />

      <div>{children}</div>
    </div>
  );
}
