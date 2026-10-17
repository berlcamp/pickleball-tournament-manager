import Link from "next/link";
import { ExternalLink, Eye, Search, ShieldCheck, Star } from "lucide-react";
import { requireSuperAdmin } from "@/lib/super-admin";
import { getAllTournaments } from "@/lib/admin-data";
import { PageHeader, EmptyState } from "@/components/page-header";
import { TournamentStatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { FeatureToggle } from "@/components/dashboard/feature-toggle";

/**
 * System-wide view of every tournament on Sortbrite.
 *
 * Deliberately near read-only: the super admin can see what organisers have
 * created and open any tournament's workspace as a viewer — editing a
 * tournament still requires being a member of it. The single exception is the
 * homepage feature flag, which is an install-wide editorial call that belongs
 * to nobody else.
 */
export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireSuperAdmin();
  const { q } = await searchParams;
  const all = await getAllTournaments();

  const term = (q ?? "").trim().toLowerCase();
  const tournaments = term
    ? all.filter((t) =>
        [t.name, t.short_code, t.location, t.ownerName, t.ownerEmail]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(term)),
      )
    : all;

  const stats = [
    { label: "Tournaments", value: all.length },
    {
      label: "In progress",
      value: all.filter(
        (t) => t.status === "group_stage" || t.status === "final_stage",
      ).length,
    },
    { label: "Completed", value: all.filter((t) => t.status === "completed").length },
    { label: "Featured", value: all.filter((t) => t.featured).length },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super admin dashboard"
        description="Every tournament on Sortbrite. Open one to look around as a viewer, or flip a switch to feature it on the homepage."
      >
        <span className="flex items-center gap-1.5 rounded-full bg-court px-3 py-1 text-xs font-semibold text-court-foreground">
          <ShieldCheck className="size-3.5" /> Super admin
        </span>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-border bg-card p-4 shadow-card"
          >
            <div className="eyebrow">{s.label}</div>
            <div className="scoreboard mt-1 text-4xl font-bold">{s.value}</div>
          </div>
        ))}
      </div>

      {/* A plain GET form: the filter survives a reload and can be linked. */}
      <form role="search" className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          name="q"
          aria-label="Search tournaments"
          defaultValue={q ?? ""}
          placeholder="Search by name, code, location or owner"
          className="pl-9"
        />
      </form>

      {tournaments.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={term ? "No matches" : "No tournaments yet"}
          description={
            term
              ? `Nothing matches "${term}".`
              : "Nobody has created a tournament on this install."
          }
        />
      ) : (
        <>
        {/* Phones get one card per tournament; the table needs a wide screen. */}
        <ul className="space-y-3 md:hidden">
          {tournaments.map((t) => (
            <li
              key={t.id}
              className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-heading text-xl font-bold leading-tight">
                    {t.name}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    /{t.short_code}
                    {t.location && ` · ${t.location}`}
                  </div>
                </div>
                <TournamentStatusBadge status={t.status} />
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Owner: </span>
                {t.ownerName ?? t.ownerEmail ?? "no owner"}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>
                  <span className="scoreboard font-bold text-foreground">
                    {t.categoryCount}
                  </span>{" "}
                  categories
                </span>
                <span>
                  <span className="scoreboard font-bold text-foreground">
                    {t.participantCount}
                  </span>{" "}
                  teams
                </span>
                <span>{formatDate(t.created_at)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <FeatureToggle
                    tournamentId={t.id}
                    name={t.name}
                    featured={t.featured}
                  />
                  On homepage
                </label>
                <div className="flex items-center gap-4">
                  <Link
                    href={`/dashboard/tournaments/${t.id}`}
                    className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary"
                  >
                    <Eye className="size-4" /> View
                  </Link>
                  <Link
                    href={`/${t.short_code}`}
                    target="_blank"
                    className="flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary"
                  >
                    Public page <ExternalLink className="size-4" />
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden rounded-2xl border border-border bg-card p-2 shadow-card md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tournament</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Categories</TableHead>
                <TableHead className="text-right">Teams</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <Star className="size-3.5" /> Homepage
                  </span>
                </TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tournaments.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/tournaments/${t.id}`}
                      className="font-semibold hover:underline"
                      title={`View ${t.name} (read only)`}
                    >
                      {t.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      /{t.short_code}
                      {t.location && ` · ${t.location}`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{t.ownerName ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {t.ownerEmail ?? "no owner"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <TournamentStatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="scoreboard text-right text-base font-bold">
                    {t.categoryCount}
                  </TableCell>
                  <TableCell className="scoreboard text-right text-base font-bold">
                    {t.participantCount}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(t.created_at)}
                  </TableCell>
                  <TableCell>
                    <FeatureToggle
                      tournamentId={t.id}
                      name={t.name}
                      featured={t.featured}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/dashboard/tournaments/${t.id}`}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        title={`View ${t.name} (read only)`}
                      >
                        <Eye className="size-4" />
                      </Link>
                      <Link
                        href={`/${t.short_code}`}
                        target="_blank"
                        className="text-muted-foreground transition-colors hover:text-foreground"
                        title={`Open ${t.name}'s public portal`}
                      >
                        <ExternalLink className="size-4" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </>
      )}
    </div>
  );
}
