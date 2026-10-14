"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FORMAT_LABELS } from "@/lib/constants";
import { ImageUploadField } from "@/components/public/image-upload-field";
import { uploadPaymentProof } from "@/actions/registration";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import type {
  Category,
  PaymentStatus,
  RegistrationStatus,
  Tournament,
} from "@/types";
import type { RegistrationView } from "@/lib/registration-data";
import { cn } from "@/lib/utils";
import {
  BadgeCheck,
  Ban,
  CalendarClock,
  Check,
  CircleDashed,
  Clock,
  CreditCard,
  ListOrdered,
  Loader2,
  Upload,
  Users,
  X,
  XCircle,
} from "lucide-react";

const STATUS_META: Record<
  RegistrationStatus,
  { label: string; blurb: string; icon: typeof Clock; chip: string }
> = {
  pending: {
    label: "Pending review",
    blurb: "The organizer is reviewing your entry. Check back for updates.",
    icon: Clock,
    chip: "bg-court-foreground/12 text-court-foreground",
  },
  approved: {
    label: "Approved",
    blurb: "You're in! Your team will appear in the brackets and schedule.",
    icon: BadgeCheck,
    chip: "bg-ball text-ball-foreground",
  },
  disqualified: {
    label: "Disqualified",
    blurb: "This entry was disqualified. Contact the organizer for details.",
    icon: Ban,
    chip: "bg-destructive text-white",
  },
  cancelled: {
    label: "Cancelled",
    blurb: "This registration was cancelled.",
    icon: XCircle,
    chip: "bg-court-foreground/12 text-court-foreground",
  },
};

const PAYMENT_META: Record<PaymentStatus, { label: string; tone: string }> = {
  unpaid: {
    label: "Unpaid",
    tone: "border-warning/50 bg-warning/15 text-foreground",
  },
  submitted: {
    label: "Receipt submitted",
    tone: "border-chart-2/40 text-chart-2",
  },
  verified: { label: "Payment verified", tone: "border-primary/40 text-primary" },
  refunded: { label: "Refunded", tone: "border-border text-muted-foreground" },
};

export function RegistrationStatusCard({
  registration,
  category,
  tournament,
}: {
  registration: RegistrationView;
  category: Category;
  tournament: Tournament;
}) {
  const [pending, startTransition] = useTransition();
  const [proof, setProof] = useState<File | null>(null);
  const [reference, setReference] = useState("");

  const status = STATUS_META[registration.status];
  const StatusIcon = status.icon;
  const payment = PAYMENT_META[registration.payment_status];

  const isLive =
    registration.status === "pending" || registration.status === "approved";
  const owesPayment =
    Number(registration.fee_amount) > 0 &&
    registration.payment_status !== "verified" &&
    registration.payment_status !== "refunded";
  const canUpload = isLive && owesPayment;

  function submitProof(event: React.FormEvent) {
    event.preventDefault();
    if (!proof) {
      toast.error("Choose an image of your receipt.");
      return;
    }
    const form = new FormData();
    form.set("payment_proof", proof);
    form.set("payment_reference", reference.trim());

    startTransition(async () => {
      const res = await uploadPaymentProof(registration.reference_code, form);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Proof of payment submitted");
      setProof(null);
      setReference("");
    });
  }

  const hasFee = Number(registration.fee_amount) > 0;

  return (
    <div className="space-y-4">
      {/* ---------- status hero ---------- */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="bg-court p-5 text-court-foreground sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "grid size-11 shrink-0 place-items-center rounded-xl",
                  status.chip,
                )}
              >
                <StatusIcon className="size-6" aria-hidden />
              </span>
              <div>
                <div className="font-heading text-xs font-semibold uppercase tracking-[0.12em] text-court-foreground/75">
                  Registration status
                </div>
                <h2 className="text-3xl font-bold uppercase leading-none">
                  {status.label}
                </h2>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="font-heading text-xs font-semibold uppercase tracking-[0.12em] text-court-foreground/75">
                Reference
              </div>
              <div className="font-mono text-base font-bold tracking-[0.12em]">
                {registration.reference_code}
              </div>
            </div>
          </div>
          <p className="mt-3 max-w-md text-sm text-court-foreground/85">
            {status.blurb}
          </p>
        </div>

        <StatusTimeline registration={registration} hasFee={hasFee} />

        {registration.admin_note && (
          <p className="mx-5 mb-5 rounded-xl border border-border bg-muted p-3 text-sm text-foreground sm:mx-6 sm:mb-6">
            <span className="font-semibold">Note from the organizer: </span>
            {registration.admin_note}
          </p>
        )}
      </section>

      {/* ---------- payment ---------- */}
      {hasFee && (
        <section
          id="payment"
          className="glass scroll-mt-20 space-y-4 rounded-2xl p-5 sm:p-6"
        >
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-heading text-xl font-bold uppercase tracking-wide">
                <CreditCard className="size-5 text-primary" aria-hidden />
                Payment
              </h2>
              <span
                className={cn(
                  "mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  payment.tone,
                )}
              >
                <CircleDashed className="size-3" aria-hidden />
                {payment.label}
              </span>
            </div>
            <div className="text-right">
              <div className="scoreboard text-3xl font-bold leading-none">
                {formatCurrency(Number(registration.fee_amount))}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {/* The stored amount is the team's total, shirts included —
                    split evenly it is what each player pays. */}
                {formatCurrency(
                  Number(registration.fee_amount) /
                    Math.max(registration.players.length, 1),
                )}{" "}
                per player
                {registration.players.length > 1 &&
                  ` × ${registration.players.length}`}
              </div>
            </div>
          </header>

          {registration.payment_proof_url && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">
                Receipt on file
                {registration.payment_submitted_at
                  ? ` · ${formatDateTime(registration.payment_submitted_at)}`
                  : ""}
              </span>
              <a
                href={registration.payment_proof_url}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-xl border border-border"
              >
                <Image
                  src={registration.payment_proof_url}
                  alt="Proof of payment"
                  width={600}
                  height={400}
                  unoptimized
                  className="h-40 w-full object-cover"
                />
              </a>
            </div>
          )}

          {canUpload ? (
            <form
              onSubmit={submitProof}
              className="space-y-4 rounded-xl border-2 border-primary/30 bg-primary/5 p-4"
            >
              <div>
                <h3 className="font-heading text-lg font-bold uppercase tracking-wide">
                  {registration.payment_proof_url
                    ? "Replace your receipt"
                    : "Upload your proof of payment"}
                </h3>
                {(tournament.payment_number || tournament.payment_name) && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    Send {formatCurrency(Number(registration.fee_amount))} to{" "}
                    {tournament.payment_number && (
                      <span className="font-mono font-medium text-foreground">
                        {tournament.payment_number}
                      </span>
                    )}
                    {tournament.payment_name && (
                      <> ({tournament.payment_name})</>
                    )}
                    , then upload the screenshot below.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ref" className="text-sm font-semibold">
                  Reference number{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="ref"
                  placeholder="e.g. 1234567890"
                  autoComplete="off"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="h-12 rounded-xl text-base sm:h-11"
                />
              </div>

              <ImageUploadField
                label="Receipt screenshot"
                required
                value={proof}
                onChange={setProof}
              />

              <Button
                type="submit"
                size="lg"
                disabled={pending || !proof}
                aria-live="polite"
                className="w-full sm:w-auto"
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />{" "}
                    Uploading receipt…
                  </>
                ) : (
                  <>
                    <Upload className="size-4" aria-hidden /> Submit proof of
                    payment
                  </>
                )}
              </Button>
            </form>
          ) : (
            registration.payment_status === "verified" && (
              <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
                Your payment has been verified by the organizer. Nothing further
                is needed.
              </p>
            )
          )}
        </section>
      )}

      {/* ---------- team ---------- */}
      <section className="glass space-y-4 rounded-2xl p-5 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-heading text-xl font-bold uppercase tracking-wide">
            <Users className="size-5 text-primary" aria-hidden />
            {registration.team_name}
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{category.name}</Badge>
            <Badge variant="outline">
              {FORMAT_LABELS[category.format]}
            </Badge>
          </div>
        </header>

        <dl className="grid gap-3 sm:grid-cols-2">
          {registration.players.map((player) => (
            <div
              key={player.id}
              className="rounded-xl border border-border p-3"
            >
              <dt className="text-xs text-muted-foreground">
                Player {player.position}
              </dt>
              <dd className="font-medium">{player.full_name}</dd>
              <div className="mt-2 flex items-center gap-3">
                {player.shirt_size && (
                  <span className="text-xs text-muted-foreground">
                    Shirt: <span className="font-medium text-foreground">{player.shirt_size}</span>
                  </span>
                )}
                {player.id_photo_url && (
                  <a
                    href={player.id_photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    View submitted ID
                  </a>
                )}
              </div>
            </div>
          ))}
        </dl>

        <dl className="grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
          <Field label="Contact number" value={registration.contact_number} />
          <Field
            label="Email"
            value={registration.contact_email ?? "Not provided"}
          />
          <Field
            label="Club"
            value={registration.club_name ?? "Not provided"}
          />
          <Field
            label="Club address"
            value={registration.club_address ?? "Not provided"}
          />
          <Field
            label="Submitted"
            value={formatDateTime(registration.created_at)}
          />
          <Field label="Tournament" value={tournament.name} />
        </dl>
      </section>

      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Button asChild variant="outline" size="lg">
          <Link href={`/${tournament.short_code}/standings`}>
            <ListOrdered className="size-4" aria-hidden /> Standings
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href={`/${tournament.short_code}/schedule`}>
            <CalendarClock className="size-4" aria-hidden /> Schedule
          </Link>
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

type StepState = "done" | "current" | "todo" | "failed";

/**
 * Submitted → payment → decision, as a horizontal tracker. Payment and the
 * organizer's decision move independently, so either can be "current" while
 * the other is already done.
 */
function StatusTimeline({
  registration,
  hasFee,
}: {
  registration: RegistrationView;
  hasFee: boolean;
}) {
  const ended =
    registration.status === "disqualified" ||
    registration.status === "cancelled";

  const steps: { label: string; detail: string; state: StepState }[] = [
    {
      label: "Submitted",
      detail: formatDate(registration.created_at),
      state: "done",
    },
  ];

  if (hasFee) {
    const p = registration.payment_status;
    steps.push({
      label: "Payment",
      detail:
        p === "verified"
          ? "Verified"
          : p === "submitted"
            ? "Receipt in review"
            : p === "refunded"
              ? "Refunded"
              : "Not paid yet",
      state:
        p === "verified" || p === "refunded"
          ? "done"
          : p === "submitted"
            ? "current"
            : ended
              ? "todo"
              : "current",
    });
  }

  steps.push({
    label: ended
      ? registration.status === "disqualified"
        ? "Disqualified"
        : "Cancelled"
      : "Approved",
    detail:
      registration.status === "approved"
        ? "You're in!"
        : ended
          ? "Entry closed"
          : "Awaiting review",
    state:
      registration.status === "approved"
        ? "done"
        : ended
          ? "failed"
          : "current",
  });

  return (
    <ol
      aria-label="Registration progress"
      className="flex items-start px-3 py-5 sm:px-6"
    >
      {steps.map((step, i) => (
        <li
          key={step.label}
          aria-current={step.state === "current" ? "step" : undefined}
          className="relative flex flex-1 flex-col items-center gap-1.5 text-center"
        >
          {i > 0 && (
            <span
              aria-hidden
              className={cn(
                "absolute top-4.5 right-1/2 h-0.5 w-full -translate-y-1/2",
                step.state === "todo" ? "bg-border" : "bg-primary",
              )}
            />
          )}
          <span
            className={cn(
              "relative z-10 grid size-9 place-items-center rounded-full",
              step.state === "done" && "bg-primary text-primary-foreground",
              step.state === "current" &&
                "border-2 border-primary bg-card text-primary",
              step.state === "todo" &&
                "border border-border bg-card text-muted-foreground",
              step.state === "failed" && "bg-destructive text-white",
            )}
          >
            {step.state === "done" ? (
              <Check className="size-5" aria-hidden />
            ) : step.state === "failed" ? (
              <X className="size-5" aria-hidden />
            ) : (
              <Clock className="size-4" aria-hidden />
            )}
          </span>
          <span className="font-heading text-sm font-bold uppercase tracking-wide">
            {step.label}
          </span>
          <span className="px-1 text-xs text-muted-foreground">
            {step.detail}
          </span>
        </li>
      ))}
    </ol>
  );
}
