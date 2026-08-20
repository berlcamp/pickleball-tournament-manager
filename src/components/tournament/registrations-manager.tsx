"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  decideRegistration,
  deleteRegistration,
  setPaymentStatus,
} from "@/actions/registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type {
  Category,
  PaymentStatus,
  RegistrationStatus,
} from "@/types";
import type { RegistrationView } from "@/lib/registration-data";
import {
  BadgeCheck,
  Ban,
  Clock,
  Download,
  ExternalLink,
  Search,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";

const STATUS_STYLE: Record<RegistrationStatus, string> = {
  pending: "border-warning/40 bg-warning/10 text-warning",
  approved: "border-primary/40 bg-primary/10 text-primary",
  disqualified: "border-destructive/40 bg-destructive/10 text-destructive",
  cancelled: "border-border bg-muted/40 text-muted-foreground",
};

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  disqualified: "Disqualified",
  cancelled: "Cancelled",
};

const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: "Unpaid",
  submitted: "Receipt in",
  verified: "Verified",
  refunded: "Refunded",
};

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  unpaid: "border-warning/40 text-warning",
  submitted: "border-chart-2/40 text-chart-2",
  verified: "border-primary/40 text-primary",
  refunded: "border-border text-muted-foreground",
};

type StatusFilter = RegistrationStatus | "all";
type PaymentFilter = PaymentStatus | "all";

export function RegistrationsManager({
  tournamentId,
  registrations,
  categories,
  canManage,
}: {
  tournamentId: string;
  registrations: RegistrationView[];
  categories: Category[];
  canManage: boolean;
}) {
  const [categoryId, setCategoryId] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [query, setQuery] = useState("");
  const [openRow, setOpenRow] = useState<RegistrationView | null>(null);

  const categoryName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const scoped = useMemo(
    () =>
      registrations.filter(
        (r) => categoryId === "all" || r.category_id === categoryId,
      ),
    [registrations, categoryId],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return scoped.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (payment !== "all" && r.payment_status !== payment) return false;
      if (!needle) return true;
      return (
        r.team_name.toLowerCase().includes(needle) ||
        r.reference_code.toLowerCase().includes(needle) ||
        r.contact_number.includes(needle) ||
        r.players.some((p) => p.full_name.toLowerCase().includes(needle))
      );
    });
  }, [scoped, status, payment, query]);

  // Stats always reflect the selected category, not the text/status filters —
  // otherwise the totals would move as you type.
  const stats = useMemo(() => {
    const approved = scoped.filter((r) => r.status === "approved");
    const collected = scoped
      .filter((r) => r.payment_status === "verified")
      .reduce((sum, r) => sum + Number(r.fee_amount), 0);
    const expected = approved.reduce(
      (sum, r) => sum + Number(r.fee_amount),
      0,
    );
    return {
      total: scoped.length,
      pending: scoped.filter((r) => r.status === "pending").length,
      approved: approved.length,
      awaitingPayment: scoped.filter(
        (r) =>
          Number(r.fee_amount) > 0 &&
          r.payment_status !== "verified" &&
          (r.status === "pending" || r.status === "approved"),
      ).length,
      collected,
      expected,
    };
  }, [scoped]);

  const exportHref = `/dashboard/tournaments/${tournamentId}/registrations/export${
    categoryId === "all" ? "" : `?category=${categoryId}`
  }`;

  return (
    <div className="space-y-5">
      {/* ---------- stats ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Registrations" value={String(stats.total)} icon={Users} />
        <Stat
          label="Pending review"
          value={String(stats.pending)}
          icon={Clock}
          tone={stats.pending > 0 ? "text-warning" : undefined}
        />
        <Stat
          label="Approved"
          value={String(stats.approved)}
          icon={BadgeCheck}
          tone="text-primary"
        />
        <Stat
          label="Fees collected"
          value={formatCurrency(stats.collected)}
          hint={`of ${formatCurrency(stats.expected)} from approved teams`}
        />
      </div>

      {/* ---------- filters ---------- */}
      <div className="glass space-y-3 rounded-2xl p-4">
        <div className="flex flex-wrap gap-2">
          <Chip
            active={categoryId === "all"}
            onClick={() => setCategoryId("all")}
          >
            All categories
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.id}
              active={categoryId === c.id}
              onClick={() => setCategoryId(c.id)}
            >
              {c.name}
            </Chip>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search team, player, code or number…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={exportHref}>
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "approved", "disqualified", "cancelled"] as const).map(
            (s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                {s === "all" ? "Any status" : STATUS_LABEL[s]}
              </Chip>
            ),
          )}
          <span className="w-px self-stretch bg-border" />
          {(["all", "unpaid", "submitted", "verified", "refunded"] as const).map(
            (p) => (
              <Chip key={p} active={payment === p} onClick={() => setPayment(p)}>
                {p === "all" ? "Any payment" : PAYMENT_LABEL[p]}
              </Chip>
            ),
          )}
        </div>
      </div>

      {/* ---------- list ---------- */}
      {filtered.length === 0 ? (
        <p className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
          {registrations.length === 0
            ? "No one has registered yet. Open registration for a category in Settings, then share your public tournament link."
            : "No registrations match these filters."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenRow(r)}
                className="glass flex w-full flex-col gap-2 rounded-xl p-4 text-left transition hover:border-primary/40 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{r.team_name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.reference_code}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {categoryName.get(r.category_id) ?? "—"} ·{" "}
                    {r.players.map((p) => p.full_name).join(", ")} ·{" "}
                    {r.contact_number}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {Number(r.fee_amount) > 0 && (
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
                        PAYMENT_STYLE[r.payment_status],
                      )}
                    >
                      {PAYMENT_LABEL[r.payment_status]}
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      STATUS_STYLE[r.status],
                    )}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <RegistrationDetail
        key={openRow?.id ?? "none"}
        tournamentId={tournamentId}
        registration={openRow}
        categoryName={
          openRow ? (categoryName.get(openRow.category_id) ?? "—") : ""
        }
        canManage={canManage}
        onClose={() => setOpenRow(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function RegistrationDetail({
  tournamentId,
  registration,
  categoryName,
  canManage,
  onClose,
}: {
  tournamentId: string;
  registration: RegistrationView | null;
  categoryName: string;
  canManage: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Pre-filled from the stored note (the dialog is keyed by registration id,
  // so this resets per row) — clearing the box is then a deliberate act.
  const [note, setNote] = useState(registration?.admin_note ?? "");

  if (!registration) return null;
  const r = registration;

  function decide(status: RegistrationStatus) {
    startTransition(async () => {
      const res = await decideRegistration(tournamentId, r.id, {
        status,
        admin_note: note,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
      onClose();
      router.refresh();
    });
  }

  function pay(next: PaymentStatus) {
    startTransition(async () => {
      const res = await setPaymentStatus(tournamentId, r.id, {
        payment_status: next,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Payment marked ${PAYMENT_LABEL[next].toLowerCase()}`);
      onClose();
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteRegistration(tournamentId, r.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Registration deleted");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={Boolean(registration)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-h-[85vh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {r.team_name}
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium",
                STATUS_STYLE[r.status],
              )}
            >
              {STATUS_LABEL[r.status]}
            </span>
          </DialogTitle>
          <DialogDescription>
            {categoryName} · {r.reference_code} ·{" "}
            {formatDateTime(r.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {/* players */}
          <div className="space-y-2">
            {r.players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-xl border border-border p-3"
              >
                {p.id_photo_url ? (
                  <a
                    href={p.id_photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                    title="Open full size"
                  >
                    <Image
                      src={p.id_photo_url}
                      alt={`ID for ${p.full_name}`}
                      width={80}
                      height={80}
                      unoptimized
                      className="size-16 rounded-lg object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border text-[0.65rem] text-muted-foreground">
                    No ID
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    Player {p.position}
                    {p.shirt_size ? ` · Shirt ${p.shirt_size}` : ""}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Detail label="Contact" value={r.contact_number} />
            <Detail label="Email" value={r.contact_email ?? "—"} />
            <Detail label="Fee" value={formatCurrency(Number(r.fee_amount))} />
            <Detail
              label="Payment reference"
              value={r.payment_reference ?? "—"}
            />
          </div>

          {/* payment */}
          {Number(r.fee_amount) > 0 && (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Proof of payment</span>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
                    PAYMENT_STYLE[r.payment_status],
                  )}
                >
                  {PAYMENT_LABEL[r.payment_status]}
                </span>
              </div>
              {r.payment_proof_url ? (
                <a
                  href={r.payment_proof_url}
                  target="_blank"
                  rel="noreferrer"
                  className="block overflow-hidden rounded-lg border border-border"
                >
                  <Image
                    src={r.payment_proof_url}
                    alt="Proof of payment"
                    width={600}
                    height={400}
                    unoptimized
                    className="max-h-56 w-full object-contain"
                  />
                </a>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No receipt uploaded yet. The team can add one from{" "}
                  <span className="font-mono">/r/{r.reference_code}</span>.
                </p>
              )}
              {canManage && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending || r.payment_status === "verified"}
                    onClick={() => pay("verified")}
                  >
                    Mark verified
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending || r.payment_status === "unpaid"}
                    onClick={() => pay("unpaid")}
                  >
                    Mark unpaid
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending || r.payment_status === "refunded"}
                    onClick={() => pay("refunded")}
                  >
                    Refunded
                  </Button>
                </div>
              )}
            </div>
          )}

          {canManage && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="admin-note">
                  Note to the team (shown on their status page)
                </Label>
                <Textarea
                  id="admin-note"
                  rows={2}
                  placeholder="e.g. Payment confirmed — see you on Saturday!"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending || r.status === "approved"}
                  onClick={() => decide("approved")}
                >
                  <BadgeCheck className="size-4" /> Approve
                </Button>
                <Button
                  variant="outline"
                  disabled={pending || r.status === "pending"}
                  onClick={() => decide("pending")}
                >
                  <Clock className="size-4" /> Back to pending
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending || r.status === "disqualified"}
                  onClick={() => decide("disqualified")}
                >
                  <Ban className="size-4" /> Disqualify
                </Button>
                <Button
                  variant="ghost"
                  disabled={pending || r.status === "cancelled"}
                  onClick={() => decide("cancelled")}
                >
                  <XCircle className="size-4" /> Cancel
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <Button asChild variant="ghost" size="sm">
                  <a href={`/r/${r.reference_code}`} target="_blank">
                    Open team view <ExternalLink className="size-4" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={remove}
                  title="Permanently delete this registration and its uploads"
                >
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {label}
      </div>
      <div className={cn("mt-1 text-2xl font-bold", tone)}>{value}</div>
      {hint && (
        <div className="mt-0.5 text-[0.7rem] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
