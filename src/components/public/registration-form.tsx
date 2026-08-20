"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ImageUploadField } from "@/components/public/image-upload-field";
import { submitRegistration } from "@/actions/registration";
import { publicRegistrationSchema } from "@/validators/registration";
import { playersPerTeam } from "@/services/registration";
import { formatCurrency } from "@/lib/format";
import { SHIRT_SIZES, type ShirtSize } from "@/types";
import { cn } from "@/lib/utils";
import type {
  PaymentDetails,
  RegistrationCategory,
} from "@/components/public/registration-types";
import {
  ArrowLeft,
  CreditCard,
  Info,
  Loader2,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

type PlayerDraft = {
  full_name: string;
  shirt_size: ShirtSize | "";
  id_photo: File | null;
};

const emptyPlayer = (): PlayerDraft => ({
  full_name: "",
  shirt_size: "",
  id_photo: null,
});

export function RegistrationForm({
  category,
  payment,
  onBack,
  onSuccess,
}: {
  category: RegistrationCategory;
  payment: PaymentDetails;
  onBack: () => void;
  onSuccess: (referenceCode: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [players, setPlayers] = useState<PlayerDraft[]>(() =>
    Array.from({ length: playersPerTeam(category.format) }, emptyPlayer),
  );
  const [contactNumber, setContactNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const feeDue = category.fee > 0;
  const proofRequired = feeDue && category.requirePaymentUpfront;

  function updatePlayer(index: number, patch: Partial<PlayerDraft>) {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  }

  /** Mirror the server's category-aware rules so mistakes surface inline. */
  function validate(): Record<string, string> {
    const next: Record<string, string> = {};

    players.forEach((player, i) => {
      if (player.full_name.trim().length < 2) {
        next[`player_${i}_name`] = "Enter the player's full name";
      }
      if (category.collectShirtSizes && !player.shirt_size) {
        next[`player_${i}_shirt`] = "Choose a size";
      }
      if (category.requirePlayerId && !player.id_photo) {
        next[`player_${i}_id`] = "A valid ID photo is required";
      }
    });

    const parsedContact = publicRegistrationSchema.shape.contact_number.safeParse(
      contactNumber,
    );
    if (!parsedContact.success) {
      next.contact_number =
        parsedContact.error.issues[0]?.message ?? "Enter a contact number";
    }
    if (contactEmail.trim()) {
      const parsedEmail = publicRegistrationSchema.shape.contact_email.safeParse(
        contactEmail,
      );
      if (!parsedEmail.success) next.contact_email = "Enter a valid email";
    }
    if (proofRequired && !proof) {
      next.proof = "Upload your proof of payment";
    }
    return next;
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error("Please fix the highlighted fields.");
      return;
    }

    const form = new FormData();
    form.set(
      "payload",
      JSON.stringify({
        category_id: category.id,
        players: players.map((p) => ({
          full_name: p.full_name.trim(),
          ...(p.shirt_size ? { shirt_size: p.shirt_size } : {}),
        })),
        contact_number: contactNumber.trim(),
        contact_email: contactEmail.trim(),
        payment_reference: paymentReference.trim(),
      }),
    );
    players.forEach((p, i) => {
      if (p.id_photo) form.set(`id_photo_${i}`, p.id_photo);
    });
    if (proof) form.set("payment_proof", proof);
    // Honeypot: bots fill every field they find, real browsers never see it.
    form.set("website", "");

    startTransition(async () => {
      const res = await submitRegistration(form);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onSuccess(res.data as string);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" /> Change category
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {category.format === "singles" ? "Singles" : "Doubles"}
          </Badge>
          <Badge>{category.name}</Badge>
        </div>
      </div>

      {/* ---------- players ---------- */}
      <section className="glass space-y-4 rounded-2xl p-5 sm:p-6">
        <header>
          <h2 className="flex items-center gap-2 font-semibold">
            <UserRound className="size-4 text-primary" />
            {category.format === "singles" ? "Player" : "Players"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Enter names exactly as they should appear in the brackets.
          </p>
        </header>

        {players.map((player, i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-border p-4"
          >
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {i + 1}
              </span>
              <span className="text-sm font-medium">
                {category.format === "singles"
                  ? "Player details"
                  : `Player ${i + 1}`}
              </span>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`player-${i}-name`}>
                Full name <span className="text-destructive">*</span>
              </Label>
              <Input
                id={`player-${i}-name`}
                autoComplete="off"
                placeholder="Juan Dela Cruz"
                value={player.full_name}
                onChange={(e) =>
                  updatePlayer(i, { full_name: e.target.value })
                }
                aria-invalid={Boolean(errors[`player_${i}_name`])}
              />
              {errors[`player_${i}_name`] && (
                <p className="text-xs text-destructive">
                  {errors[`player_${i}_name`]}
                </p>
              )}
            </div>

            {category.collectShirtSizes && (
              <div className="space-y-1.5">
                <Label>
                  T-shirt size <span className="text-destructive">*</span>
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {SHIRT_SIZES.map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => updatePlayer(i, { shirt_size: size })}
                      className={cn(
                        "h-9 min-w-11 rounded-lg border px-3 text-sm font-medium transition",
                        player.shirt_size === size
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                      )}
                      aria-pressed={player.shirt_size === size}
                    >
                      {size}
                    </button>
                  ))}
                </div>
                {errors[`player_${i}_shirt`] && (
                  <p className="text-xs text-destructive">
                    {errors[`player_${i}_shirt`]}
                  </p>
                )}
              </div>
            )}

            {category.requirePlayerId && (
              <ImageUploadField
                label="Valid ID"
                hint="Any government or school ID"
                required
                value={player.id_photo}
                onChange={(file) => updatePlayer(i, { id_photo: file })}
                error={errors[`player_${i}_id`]}
              />
            )}
          </div>
        ))}
      </section>

      {/* ---------- contact ---------- */}
      <section className="glass space-y-4 rounded-2xl p-5 sm:p-6">
        <header>
          <h2 className="flex items-center gap-2 font-semibold">
            <Phone className="size-4 text-primary" />
            Contact
          </h2>
          <p className="text-xs text-muted-foreground">
            How the organizer reaches your team about schedules and results.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contact-number">
              Mobile number <span className="text-destructive">*</span>
            </Label>
            <Input
              id="contact-number"
              inputMode="tel"
              placeholder="09XX XXX XXXX"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              aria-invalid={Boolean(errors.contact_number)}
            />
            {errors.contact_number && (
              <p className="text-xs text-destructive">
                {errors.contact_number}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email (optional)</Label>
            <Input
              id="contact-email"
              type="email"
              inputMode="email"
              placeholder="you@example.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              aria-invalid={Boolean(errors.contact_email)}
            />
            {errors.contact_email && (
              <p className="text-xs text-destructive">{errors.contact_email}</p>
            )}
          </div>
        </div>
      </section>

      {/* ---------- payment ---------- */}
      {feeDue && (
        <section className="glass space-y-4 rounded-2xl p-5 sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <CreditCard className="size-4 text-primary" />
                Registration fee
              </h2>
              <p className="text-xs text-muted-foreground">
                {proofRequired
                  ? "Proof of payment is required to complete registration."
                  : "You may pay later — your reference link lets you upload the receipt anytime."}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-primary">
                {formatCurrency(category.fee)}
              </div>
              <div className="text-[0.7rem] text-muted-foreground">per team</div>
            </div>
          </header>

          {(payment.name || payment.number || payment.qr) && (
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-background/40 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1 space-y-1.5 text-sm">
                {payment.number && (
                  <div>
                    <div className="text-xs text-muted-foreground">
                      GCash number
                    </div>
                    <div className="font-mono text-base font-semibold tracking-wide">
                      {payment.number}
                    </div>
                  </div>
                )}
                {payment.name && (
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Account name
                    </div>
                    <div className="font-medium">{payment.name}</div>
                  </div>
                )}
                {payment.instructions && (
                  <p className="flex items-start gap-1.5 pt-1 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    {payment.instructions}
                  </p>
                )}
              </div>
              {payment.qr && (
                <Image
                  src={payment.qr}
                  alt="Payment QR code"
                  width={160}
                  height={160}
                  unoptimized
                  className="mx-auto size-36 rounded-lg bg-white object-contain p-1.5"
                />
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="payment-reference">
              Payment reference number (optional)
            </Label>
            <Input
              id="payment-reference"
              placeholder="e.g. 1234567890"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
          </div>

          <ImageUploadField
            label="Proof of payment"
            hint={proofRequired ? undefined : "You can add this later"}
            required={proofRequired}
            value={proof}
            onChange={setProof}
            error={errors.proof}
          />
        </section>
      )}

      <div className="glass flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          Your ID photos and receipt are stored privately and are only visible
          to the tournament organizer.
        </p>
        <Button type="submit" size="lg" disabled={pending} className="sm:w-auto">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Submitting…
            </>
          ) : (
            "Submit registration"
          )}
        </Button>
      </div>
    </form>
  );
}
