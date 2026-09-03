"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ImageUploadField } from "@/components/public/image-upload-field";
import { uploadPaymentProof } from "@/actions/registration";
import { formatCurrency, formatDateTime } from "@/lib/format";
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
  CircleDashed,
  Clock,
  CreditCard,
  Loader2,
  Users,
  XCircle,
} from "lucide-react";

const STATUS_META: Record<
  RegistrationStatus,
  { label: string; blurb: string; icon: typeof Clock; tone: string }
> = {
  pending: {
    label: "Pending review",
    blurb: "The organizer is reviewing your entry. Check back for updates.",
    icon: Clock,
    tone: "border-warning/40 bg-warning/10 text-warning",
  },
  approved: {
    label: "Approved",
    blurb: "You're in! Your team will appear in the brackets and schedule.",
    icon: BadgeCheck,
    tone: "border-primary/40 bg-primary/10 text-primary",
  },
  disqualified: {
    label: "Disqualified",
    blurb: "This entry was disqualified. Contact the organizer for details.",
    icon: Ban,
    tone: "border-destructive/40 bg-destructive/10 text-destructive",
  },
  cancelled: {
    label: "Cancelled",
    blurb: "This registration was cancelled.",
    icon: XCircle,
    tone: "border-border bg-muted/40 text-muted-foreground",
  },
};

const PAYMENT_META: Record<PaymentStatus, { label: string; tone: string }> = {
  unpaid: { label: "Unpaid", tone: "border-warning/40 text-warning" },
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
  const router = useRouter();
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
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {/* ---------- status hero ---------- */}
      <section className={cn("rounded-2xl border p-6 sm:p-7", status.tone)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <StatusIcon className="mt-0.5 size-6 shrink-0" />
            <div>
              <div className="text-xl font-bold">{status.label}</div>
              <p className="mt-0.5 max-w-md text-sm opacity-90">
                {status.blurb}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[0.7rem] uppercase tracking-wide opacity-80">
              Reference
            </div>
            <div className="font-mono text-base font-bold tracking-[0.12em]">
              {registration.reference_code}
            </div>
          </div>
        </div>

        {registration.admin_note && (
          <p className="mt-4 rounded-xl border border-current/20 bg-background/40 p-3 text-sm text-foreground">
            <span className="font-medium">Note from the organizer: </span>
            {registration.admin_note}
          </p>
        )}
      </section>

      {/* ---------- team ---------- */}
      <section className="glass space-y-4 rounded-2xl p-5 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Users className="size-4 text-primary" />
            {registration.team_name}
          </h2>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{category.name}</Badge>
            <Badge variant="outline">
              {category.format === "singles" ? "Singles" : "Doubles"}
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

        <div className="grid gap-3 text-sm sm:grid-cols-2">
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
        </div>
      </section>

      {/* ---------- payment ---------- */}
      {Number(registration.fee_amount) > 0 && (
        <section className="glass space-y-4 rounded-2xl p-5 sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <CreditCard className="size-4 text-primary" />
                Payment
              </h2>
              <span
                className={cn(
                  "mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                  payment.tone,
                )}
              >
                <CircleDashed className="size-3" />
                {payment.label}
              </span>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">
                {formatCurrency(Number(registration.fee_amount))}
              </div>
              <div className="text-[0.7rem] text-muted-foreground">
                registration fee
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
              className="space-y-3 rounded-xl border border-border p-4"
            >
              <div>
                <h3 className="text-sm font-medium">
                  {registration.payment_proof_url
                    ? "Replace your receipt"
                    : "Upload your proof of payment"}
                </h3>
                {(tournament.payment_number || tournament.payment_name) && (
                  <p className="mt-1 text-xs text-muted-foreground">
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
                <Label htmlFor="ref">Reference number (optional)</Label>
                <Input
                  id="ref"
                  placeholder="e.g. 1234567890"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>

              <ImageUploadField
                label="Receipt screenshot"
                required
                value={proof}
                onChange={setProof}
              />

              <Button type="submit" disabled={pending || !proof}>
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Uploading…
                  </>
                ) : (
                  "Submit proof of payment"
                )}
              </Button>
            </form>
          ) : (
            registration.payment_status === "verified" && (
              <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground">
                Your payment has been verified by the organizer. Nothing further
                is needed.
              </p>
            )
          )}
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href={`/${tournament.short_code}/standings`}>
            View standings
          </Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href={`/${tournament.short_code}/schedule`}>
            View schedule
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
