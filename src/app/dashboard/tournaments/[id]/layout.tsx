import { notFound } from "next/navigation";
import { getTournamentContext } from "@/lib/data";
import { WorkspaceNav } from "@/components/tournament/workspace-nav";
import { ROLE_LABELS, roleAtLeast } from "@/lib/constants";
import { MapPin, Calendar } from "lucide-react";
import { WorkspaceTopBar } from "@/components/tournament/workspace-top-bar";
import { formatEventDates } from "@/lib/format";
import { CourtBackdrop } from "@/components/court-backdrop";

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

  return (
    <div className="space-y-2">
      <WorkspaceTopBar
        id={id}
        name={t.name}
        shortCode={t.short_code}
        roleLabel={ROLE_LABELS[role]}
        canManage={canManage}
      />

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="relative isolate bg-court text-court-foreground">
          <CourtBackdrop />
          <div className="p-6 sm:px-9 sm:py-8">
            <h1 className="text-balance text-3xl font-bold uppercase leading-[0.95] sm:text-5xl">
              {t.name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-court-foreground/80">
              <span className="flex items-center gap-1.5">
                <Calendar className="size-4" />{" "}
                {formatEventDates(categories.map((c) => c.event_date))}
              </span>
              {t.location && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4" /> {t.location}
                </span>
              )}
            </div>
          </div>
        </div>
        <WorkspaceNav id={id} categories={categories} />
      </section>

      <div className="pt-2">{children}</div>
    </div>
  );
}
