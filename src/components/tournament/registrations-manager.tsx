"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  changeRegistrationCategory,
  decideRegistration,
  setPaymentStatus,
} from "@/actions/registration";
import { EmptyState } from "@/components/page-header";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { playersPerTeam } from "@/services/registration";
import type {
  Category,
  PaymentStatus,
  RegistrationStatus,
} from "@/types";
import type { RegistrationView } from "@/lib/registration-data";
import {
  BadgeCheck,
  Ban,
  ChevronRight,
  ClipboardList,
  Clock,
  Download,
  ArrowRightLeft,
  ExternalLink,
  Loader2,
  Search,
  SearchX,
  Users,
  Wallet,
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
  submitted: "border-chart-2/40 bg-chart-2/10 text-chart-2",
  verified: "border-primary/40 text-primary",
  refunded: "border-border text-muted-foreground",
};

type StatusFilter = RegistrationStatus | "all";
type PaymentFilter = PaymentStatus | "all";

/** A registration as shown: the stored row plus an in-flight save marker. */
type ShownRegistration = RegistrationView & { saving?: boolean };
type Patch = { id: string } & Partial<
  Pick<RegistrationView, "status" | "payment_status" | "admin_note">
>;

export function RegistrationsManager({
  tournamentId,
  registrations,
  categories,
  categoryId,
  canManage,
}: {
  tournamentId: string;
  registrations: RegistrationView[];
  categories: Category[];
  /** The category picked in the workspace navigation. */
  categoryId: string;
  canManage: boolean;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [payment, setPayment] = useState<PaymentFilter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Decisions show on the list the moment they're made. The revalidated props
  // take over when the action returns; a failed save falls back to them on its
  // own, so the only thing to do on error is say so.
  const [shown, applyPatch] = useOptimistic(
    registrations as ShownRegistration[],
    (list, patch: Patch) =>
      list.map((r) =>
        r.id === patch.id ? { ...r, ...patch, saving: true } : r,
      ),
  );

  function save(
    patch: Patch,
    call: () => Promise<{ ok: boolean; error?: string }>,
    done: string,
  ) {
    startTransition(async () => {
      applyPatch(patch);
      const res = await call();
      if (!res.ok) toast.error(res.error ?? "Couldn't save that change.");
      else toast.success(done);
    });
  }

  const openRow = shown.find((r) => r.id === openId) ?? null;

  const categoryName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  const scoped = useMemo(
    () => shown.filter((r) => r.category_id === categoryId),
    [shown, categoryId],
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
        (r.club_name?.toLowerCase().includes(needle) ?? false) ||
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

  const exportHref = `/dashboard/tournaments/${tournamentId}/registrations/export?category=${categoryId}`;

  const filtersActive =
    status !== "all" || payment !== "all" || query.trim() !== "";

  return (
    <div className="space-y-5">
      {/* ---------- stats ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sign-ups" value={String(stats.total)} icon={Users} />
        <Stat
          label="To review"
          value={String(stats.pending)}
          icon={Clock}
          tone={stats.pending > 0 ? "text-warning" : undefined}
          onClick={
            stats.pending > 0
              ? () => {
                  setStatus("pending");
                  setPayment("all");
                }
              : undefined
          }
          hint={stats.pending > 0 ? "Tap to show them" : "All caught up"}
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
          icon={Wallet}
          hint={`of ${formatCurrency(stats.expected)} from approved teams`}
        />
      </div>

      {/* ---------- filters ---------- */}
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search registrations"
              placeholder="Search team, player, code or number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button asChild variant="outline">
            <a href={exportHref}>
              <Download className="size-4" /> Export CSV
            </a>
          </Button>
        </div>

        <ChipRow label="Status">
          {(["all", "pending", "approved", "disqualified", "cancelled"] as const).map(
            (s) => (
              <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
                {s === "all" ? "Any status" : STATUS_LABEL[s]}
              </Chip>
            ),
          )}
        </ChipRow>
        <ChipRow label="Payment">
          {(["all", "unpaid", "submitted", "verified", "refunded"] as const).map(
            (p) => (
              <Chip key={p} active={payment === p} onClick={() => setPayment(p)}>
                {p === "all" ? "Any payment" : PAYMENT_LABEL[p]}
              </Chip>
            ),
          )}
        </ChipRow>
      </div>

      {/* ---------- list ---------- */}
      {filtered.length === 0 ? (
        registrations.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No sign-ups yet"
            description="Open registration for a category in Settings, then share your public tournament link. New teams appear here."
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title="Nothing matches"
            description="No registrations match these filters."
          >
            {filtersActive && (
              <Button
                variant="outline"
                onClick={() => {
                  setStatus("all");
                  setPayment("all");
                  setQuery("");
                }}
              >
                Clear filters
              </Button>
            )}
          </EmptyState>
        )
      ) : (
        <ul className="space-y-2">
          <li className="eyebrow px-1">
            {filtered.length} of {scoped.length} shown
          </li>
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenId(r.id)}
                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-card outline-none transition-[border-color,box-shadow] hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate font-semibold">{r.team_name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {r.reference_code}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-muted-foreground">
                    {r.players.map((p) => p.full_name).join(", ")}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {categoryName.get(r.category_id) ?? "—"} · {r.contact_number}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <StatusChip status={r.status} />
                    {Number(r.fee_amount) > 0 && (
                      <PaymentChip status={r.payment_status} />
                    )}
                    {r.saving && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Loader2 className="size-3 animate-spin" /> Saving
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <RegistrationDetail
        key={openId ?? "none"}
        tournamentId={tournamentId}
        registration={openRow}
        categoryName={
          openRow ? (categoryName.get(openRow.category_id) ?? "—") : ""
        }
        categories={categories}
        canManage={canManage}
        onClose={() => setOpenId(null)}
        onDecide={(next, note) => {
          if (!openRow) return;
          const id = openRow.id;
          // A decision ends the review, so the dialog closes straight away and
          // the list carries the new status while the save finishes.
          setOpenId(null);
          save(
            { id, status: next, admin_note: note.trim() || null },
            () =>
              decideRegistration(tournamentId, id, {
                status: next,
                admin_note: note,
              }),
            `${openRow.team_name} marked ${STATUS_LABEL[next].toLowerCase()}`,
          );
        }}
        onPay={(next) => {
          if (!openRow) return;
          const id = openRow.id;
          // Payment usually comes right before approval, so the dialog stays
          // open for the next click.
          save(
            { id, payment_status: next },
            () =>
              setPaymentStatus(tournamentId, id, { payment_status: next }),
            `Payment marked ${PAYMENT_LABEL[next].toLowerCase()}`,
          );
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function RegistrationDetail({
  tournamentId,
  registration,
  categoryName,
  categories,
  canManage,
  onClose,
  onDecide,
  onPay,
}: {
  tournamentId: string;
  registration: ShownRegistration | null;
  categoryName: string;
  categories: Category[];
  canManage: boolean;
  onClose: () => void;
  onDecide: (status: RegistrationStatus, note: string) => void;
  onPay: (status: PaymentStatus) => void;
}) {
  // Pre-filled from the stored note (the dialog is keyed by registration id,
  // so this resets per row) — clearing the box is then a deliberate act.
  const [note, setNote] = useState(registration?.admin_note ?? "");
  // Disqualifying pulls a team out of the draw, so it takes a second tap.
  const [confirmDq, setConfirmDq] = useState(false);

  if (!registration) return null;
  const r = registration;
  const busy = Boolean(r.saving);

  return (
    <Dialog
      open={Boolean(registration)}
      onOpenChange={(open) => !open && onClose()}
    >
      <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-heading text-2xl font-bold">
            {r.team_name}
            <StatusChip status={r.status} />
          </DialogTitle>
          <DialogDescription>
            {categoryName} · <span className="font-mono">{r.reference_code}</span>{" "}
            · {formatDateTime(r.created_at)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* players */}
          <section className="space-y-2">
            <h3 className="eyebrow">
              {r.players.length === 1 ? "Player" : "Players"}
            </h3>
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
          </section>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 text-sm">
            <Detail label="Contact" value={r.contact_number} />
            <Detail label="Email" value={r.contact_email ?? "—"} />
            <Detail label="Club" value={r.club_name ?? "—"} />
            <Detail label="Club address" value={r.club_address ?? "—"} />
            <Detail label="Fee" value={formatCurrency(Number(r.fee_amount))} />
            <Detail
              label="Payment reference"
              value={r.payment_reference ?? "—"}
            />
          </dl>

          {/* payment */}
          {Number(r.fee_amount) > 0 && (
            <section className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-lg font-bold">
                  Proof of payment
                </h3>
                <PaymentChip status={r.payment_status} />
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
                <p className="text-sm text-muted-foreground">
                  No receipt uploaded yet. The team can add one from{" "}
                  <span className="font-mono">/r/{r.reference_code}</span>.
                </p>
              )}
              {canManage && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant={
                      r.payment_status === "submitted" ? "default" : "outline"
                    }
                    disabled={busy || r.payment_status === "verified"}
                    onClick={() => onPay("verified")}
                  >
                    <BadgeCheck className="size-4" /> Mark verified
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || r.payment_status === "unpaid"}
                    onClick={() => onPay("unpaid")}
                  >
                    Mark unpaid
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || r.payment_status === "refunded"}
                    onClick={() => onPay("refunded")}
                  >
                    Refunded
                  </Button>
                  {busy && (
                    <Loader2
                      className="size-4 self-center animate-spin text-muted-foreground"
                      aria-label="Saving"
                    />
                  )}
                </div>
              )}
            </section>
          )}

          {canManage && (
            <>
              <section className="space-y-3">
                <h3 className="font-heading text-lg font-bold">Decision</h3>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-note">Note to the team</Label>
                  <Textarea
                    id="admin-note"
                    rows={2}
                    placeholder="e.g. Payment confirmed — see you on Saturday!"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional. Shown on their status page and saved with your
                    decision.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button
                    className="col-span-2 sm:col-span-1"
                    disabled={busy || r.status === "approved"}
                    onClick={() => onDecide("approved", note)}
                  >
                    <BadgeCheck className="size-4" /> Approve
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy || r.status === "pending"}
                    onClick={() => onDecide("pending", note)}
                  >
                    <Clock className="size-4" /> Back to pending
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy || r.status === "cancelled"}
                    onClick={() => onDecide("cancelled", note)}
                  >
                    <XCircle className="size-4" /> Cancel entry
                  </Button>
                  <Button
                    variant="destructive"
                    className="col-span-2 sm:col-span-1"
                    disabled={busy || r.status === "disqualified"}
                    onClick={() =>
                      confirmDq
                        ? onDecide("disqualified", note)
                        : setConfirmDq(true)
                    }
                  >
                    <Ban className="size-4" />
                    {confirmDq ? "Tap again to disqualify" : "Disqualify"}
                  </Button>
                </div>
                {confirmDq && (
                  <p className="text-xs text-destructive">
                    Disqualifying takes the team off the Teams list if it was
                    already added.
                  </p>
                )}
              </section>

              <ChangeCategory
                tournamentId={tournamentId}
                registration={r}
                categories={categories}
                onDone={() => {
                  onClose();
                }}
              />

              <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                <Button asChild variant="ghost" size="sm">
                  <a href={`/r/${r.reference_code}`} target="_blank">
                    Open team view <ExternalLink className="size-4" />
                  </a>
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

/**
 * Move the entry to another category. Only categories that take the same
 * number of players are offered, and a note is required — it replaces the
 * team's status-page note so they can see why they were moved.
 */
function ChangeCategory({
  tournamentId,
  registration: r,
  categories,
  onDone,
}: {
  tournamentId: string;
  registration: RegistrationView;
  categories: Category[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");

  const options = categories.filter(
    (c) =>
      c.id !== r.category_id && playersPerTeam(c.format) === r.players.length,
  );
  const noteTooShort = note.trim().length < 3;
  const canSubmit = Boolean(target) && !noteTooShort;

  function submit() {
    startTransition(async () => {
      const res = await changeRegistrationCategory(tournamentId, r.id, {
        category_id: target,
        admin_note: note,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const name = categories.find((c) => c.id === target)?.name;
      toast.success(`Moved to ${name ?? "the new category"}`);
      onDone();
    });
  }

  return (
    <section className="space-y-2 rounded-xl border border-border p-3">
      <h3 className="flex items-center gap-1.5 font-heading text-lg font-bold">
        <ArrowRightLeft className="size-4 text-primary" /> Change category
      </h3>
      {r.participant_id ? (
        <p className="text-sm text-muted-foreground">
          This team is already on the Teams list. Remove it there before
          moving it to another category.
        </p>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No other category takes{" "}
          {r.players.length === 1 ? "one player" : `${r.players.length} players`}{" "}
          per entry.
        </p>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label>Move to</Label>
            <Select
              items={options.map((c) => ({ value: c.id, label: c.name }))}
              value={target || null}
              onValueChange={(v) => setTarget(v ? String(v) : "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {options.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-note">Reason</Label>
            <Textarea
              id="category-note"
              rows={2}
              placeholder="e.g. Moved to Intermediate to match your skill level."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-invalid={note.length > 0 && noteTooShort}
            />
            <p
              className={cn(
                "text-xs",
                note.length > 0 && noteTooShort
                  ? "text-destructive"
                  : "text-muted-foreground",
              )}
            >
              Required. The team sees this on their status page.
            </p>
          </div>
          <Button
            variant="outline"
            disabled={pending || !canSubmit}
            onClick={submit}
          >
            {pending && <Loader2 className="size-4 animate-spin" />}
            {pending ? "Moving…" : "Move registration"}
          </Button>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function StatusChip({ status }: { status: RegistrationStatus }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        STATUS_STYLE[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function PaymentChip({ status }: { status: PaymentStatus }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
        PAYMENT_STYLE[status],
      )}
    >
      {PAYMENT_LABEL[status]}
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow truncate">{label}</span>
        {Icon && <Icon className="size-4 shrink-0 text-primary" />}
      </div>
      <div className={cn("scoreboard mt-1 truncate text-3xl font-bold", tone)}>
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      )}
    </>
  );
  const cls =
    "rounded-2xl border border-border bg-card p-4 text-left shadow-card";
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        cls,
        "outline-none transition-[border-color] hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
    >
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** One filter dimension: a label, then chips that scroll sideways on phones. */
function ChipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="eyebrow hidden w-20 shrink-0 sm:block">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0"
      >
        {children}
      </div>
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
      aria-pressed={active}
      className={cn(
        "min-h-10 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 sm:min-h-8 sm:text-xs",
        active
          ? "border-court bg-court text-court-foreground"
          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow text-[0.7rem]">{label}</dt>
      <dd className="break-words font-medium">{value}</dd>
    </div>
  );
}
