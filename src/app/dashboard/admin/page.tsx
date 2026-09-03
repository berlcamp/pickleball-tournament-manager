import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
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

/**
 * System-wide, read-only view of every tournament on PicklePro. There is no
 * action on this page by design: the super admin can see what organisers have
 * created, and reaches anything further through the public portal — editing
 * still requires being a member of the tournament.
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
    { label: "Teams", value: all.reduce((n, t) => n + t.participantCount, 0) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Super admin dashboard"
        description="Every tournament on PicklePro. View only — nothing here can be edited."
      >
        <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <ShieldCheck className="size-3.5" /> Read only
        </span>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-4">
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* A plain GET form: the filter survives a reload and can be linked. */}
      <form className="flex gap-2">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name, code, location or owner"
          className="max-w-sm"
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
        <div className="glass rounded-2xl p-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tournament</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Categories</TableHead>
                <TableHead className="text-right">Teams</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tournaments.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
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
                  <TableCell className="text-right tabular-nums">
                    {t.categoryCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.participantCount}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(t.created_at)}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/${t.short_code}`}
                      target="_blank"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      title={`Open ${t.name}'s public portal`}
                    >
                      <ExternalLink className="size-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
