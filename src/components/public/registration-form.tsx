"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploadField } from "@/components/public/image-upload-field";
import { StepProgress } from "@/components/public/step-progress";
import { submitRegistration } from "@/actions/registration";
import { publicRegistrationSchema } from "@/validators/registration";
import {
  playersPerTeam,
  registrationTotal,
  feePerPlayer,
} from "@/services/registration";
import { FORMAT_LABELS } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { SHIRT_SIZES, type ShirtSize } from "@/types";
import { cn } from "@/lib/utils";
import type {
  PaymentDetails,
  RegistrationCategory,
} from "@/components/public/registration-types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Copy,
  Info,
  Loader2,
  ShieldCheck,
  Shirt,
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

type StepKey = "players" | "contact" | "payment";
type Errors = Record<string, string>;

/** Touch-sized field: the shared Input is compact for the dashboard. */
const FIELD = "h-12 rounded-xl px-3.5 text-base sm:h-11";

/**
 * Error keys → the element that should take focus when that error is the
 * first one on the step. Keeps "Continue" from silently doing nothing on a
 * phone, where the invalid field may be scrolled off-screen.
 */
function fieldIdFor(key: string): string {
  return key.replaceAll("_", "-");
}

/**
 * Steps two onward of public registration, one short screen at a time:
 * players, then contact and club, then payment when a fee is due. Each step
 * validates on its own so mistakes are caught next to where they were made,
 * and nothing is sent until the final step.
 */
export function RegistrationForm({
  category,
  payment,
  onBack,
  onSuccess,
}: {
  category: RegistrationCategory;
  payment: PaymentDetails;
  onBack: () => void;
  /** `amountDue` is the team's total, shirts included. */
  onSuccess: (referenceCode: string, amountDue: number) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [players, setPlayers] = useState<PlayerDraft[]>(() =>
    Array.from({ length: playersPerTeam(category.format) }, emptyPlayer),
  );
  const [contactNumber, setContactNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [clubName, setClubName] = useState("");
  const [clubAddress, setClubAddress] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [includeShirt, setIncludeShirt] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [stepIndex, setStepIndex] = useState(0);

  const topRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  const shirtOffered = category.collectShirtSizes;
  const wantsShirt = shirtOffered && includeShirt;
  const shirtPrice = category.shirtPrice;
  const total = registrationTotal(
    category.fee,
    players.length,
    wantsShirt,
    shirtPrice,
  );
  const feeDue = total > 0;
  const perPlayerFee = feePerPlayer(category.fee, category.format);
  const proofRequired = feeDue && category.requirePaymentUpfront;
  const isTeam = players.length > 1;

  const steps: StepKey[] = feeDue
    ? ["players", "contact", "payment"]
    : ["players", "contact"];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex >= steps.length - 1;

  // Each step starts at the top of the card, with focus on its heading so
  // screen readers announce the new screen.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [stepIndex]);

  function clearError(key: string) {
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function updatePlayer(index: number, patch: Partial<PlayerDraft>) {
    setPlayers((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  }

  // ---------- validation (mirrors the server's category-aware rules) -------

  function validatePlayers(): Errors {
    const next: Errors = {};
    players.forEach((player, i) => {
      if (player.full_name.trim().length < 2) {
        next[`player_${i}_name`] = "Enter the player's full name";
      }
      if (wantsShirt && !player.shirt_size) {
        next[`player_${i}_shirt`] = "Choose a shirt size";
      }
      if (category.requirePlayerId && !player.id_photo) {
        next[`player_${i}_id`] = "A photo of a valid ID is required";
      }
    });
    return next;
  }

  function validateContact(): Errors {
    const next: Errors = {};
    const shape = publicRegistrationSchema.shape;
    const contact = shape.contact_number.safeParse(contactNumber);
    if (!contact.success) {
      next.contact_number =
        contact.error.issues[0]?.message ?? "Enter a mobile number";
    }
    if (contactEmail.trim()) {
      if (!shape.contact_email.safeParse(contactEmail).success) {
        next.contact_email = "Enter a valid email";
      }
    }
    const club = shape.club_name.safeParse(clubName);
    if (!club.success) {
      next.club_name = club.error.issues[0]?.message ?? "Enter your club name";
    }
    const address = shape.club_address.safeParse(clubAddress);
    if (!address.success) {
      next.club_address =
        address.error.issues[0]?.message ?? "Enter your club address";
    }
    return next;
  }

  function validatePayment(): Errors {
    return proofRequired && !proof
      ? { payment_proof: "Upload a screenshot of your payment" }
      : {};
  }

  const validators: Record<StepKey, () => Errors> = {
    players: validatePlayers,
    contact: validateContact,
    payment: validatePayment,
  };

  /** Show `found` and move focus to the first problem. */
  function reportErrors(found: Errors): boolean {
    setErrors(found);
    const first = Object.keys(found)[0];
    if (!first) return false;
    requestAnimationFrame(() => {
      const el = document.getElementById(fieldIdFor(first));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
    });
    return true;
  }

  function goBack() {
    if (stepIndex === 0) onBack();
    else setStepIndex((i) => i - 1);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (reportErrors(validators[step]())) return;

    if (!isLast) {
      setStepIndex((i) => i + 1);
      return;
    }

    // Final step: re-check everything in case an earlier step was edited
    // into an invalid state and skipped past.
    for (let i = 0; i < steps.length; i++) {
      const found = validators[steps[i]]();
      if (Object.keys(found).length > 0) {
        setStepIndex(i);
        reportErrors(found);
        return;
      }
    }

    const form = new FormData();
    form.set(
      "payload",
      JSON.stringify({
        category_id: category.id,
        players: players.map((p) => ({
          full_name: p.full_name.trim(),
          ...(wantsShirt && p.shirt_size ? { shirt_size: p.shirt_size } : {}),
        })),
        include_shirt: wantsShirt,
        contact_number: contactNumber.trim(),
        contact_email: contactEmail.trim(),
        club_name: clubName.trim(),
        club_address: clubAddress.trim(),
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
      onSuccess(res.data as string, total);
    });
  }

  const STEP_COPY: Record<StepKey, { title: string; body: string }> = {
    players: {
      title: "Who's playing?",
      body:
        category.format === "blind_pairing"
          ? "Register on your own — the organizer draws your partner at random."
          : "Enter names exactly as they should appear in the brackets.",
    },
    contact: {
      title: "Contact & club",
      body: "How the organizer reaches your team, and the club you represent.",
    },
    payment: {
      title: "Pay the registration fee",
      body: proofRequired
        ? "Send the fee, then upload a screenshot of the payment."
        : "Pay now, or later — your status link lets you upload the receipt anytime.",
    },
  };

  // Category choice counts as step 1 of the whole flow.
  const currentStep = stepIndex + 2;
  const STEP_LABEL: Record<StepKey, string> = {
    players: isTeam ? "Players" : "Player",
    contact: "Contact",
    payment: "Payment",
  };
  const stepLabels = ["Category", ...steps.map((k) => STEP_LABEL[k])];
  // Photos make the request slow on mobile data — say so on the button.
  const sendsPhotos = Boolean(proof) || players.some((p) => p.id_photo);

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div ref={topRef} className="scroll-mt-36 space-y-4">
        {/* ---------- progress ---------- */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={goBack}
            className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {stepIndex === 0 ? "Back to categories" : "Back"}
          </button>
          <StepProgress steps={stepLabels} current={currentStep - 1} />
        </div>

        {/* ---------- chosen category ---------- */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-card">
          <div className="min-w-0">
            <div className="eyebrow">Your category</div>
            <div className="truncate font-heading text-lg font-bold uppercase leading-tight tracking-wide">
              {category.name}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {[
                FORMAT_LABELS[category.format],
                category.eventDate ? formatDate(category.eventDate) : null,
                perPlayerFee > 0
                  ? `${formatCurrency(perPlayerFee)} per player`
                  : "Free entry",
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="min-h-11 shrink-0 rounded-lg px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Change
          </button>
        </div>
      </div>

      {/* ---------- current step ---------- */}
      <section className="glass space-y-5 rounded-2xl p-4 sm:p-6">
        <header className="space-y-1">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold uppercase leading-none tracking-wide outline-none sm:text-3xl"
          >
            {STEP_COPY[step].title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {STEP_COPY[step].body}
          </p>
        </header>

        {step === "players" && (
          <div className="space-y-4">
            {players.map((player, i) => (
              <fieldset
                key={i}
                className={cn(
                  "space-y-4",
                  isTeam && "rounded-xl border border-border p-4",
                )}
              >
                {isTeam && (
                  <legend className="-ml-1 px-1 font-heading text-base font-bold uppercase tracking-wide">
                    Player {i + 1}
                  </legend>
                )}

                <Field
                  id={`player-${i}-name`}
                  label="Full name"
                  required
                  error={errors[`player_${i}_name`]}
                >
                  <Input
                    id={`player-${i}-name`}
                    autoComplete="off"
                    autoCapitalize="words"
                    placeholder="Juan Dela Cruz"
                    value={player.full_name}
                    onChange={(e) => {
                      updatePlayer(i, { full_name: e.target.value });
                      clearError(`player_${i}_name`);
                    }}
                    aria-invalid={Boolean(errors[`player_${i}_name`])}
                    aria-describedby={describedBy(
                      `player-${i}-name`,
                      errors[`player_${i}_name`],
                      false,
                    )}
                    className={FIELD}
                  />
                </Field>

                {wantsShirt && (
                  <Field
                    id={`player-${i}-shirt`}
                    label="T-shirt size"
                    required
                    error={errors[`player_${i}_shirt`]}
                  >
                    <div
                      id={`player-${i}-shirt`}
                      tabIndex={-1}
                      role="radiogroup"
                      aria-label={`T-shirt size for player ${i + 1}`}
                      className="grid grid-cols-4 gap-2 outline-none sm:grid-cols-7"
                    >
                      {SHIRT_SIZES.map((size) => {
                        const active = player.shirt_size === size;
                        return (
                          <button
                            key={size}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => {
                              updatePlayer(i, { shirt_size: size });
                              clearError(`player_${i}_shirt`);
                            }}
                            className={cn(
                              "h-11 rounded-xl border text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                              active
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
                            )}
                          >
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </Field>
                )}

                {category.requirePlayerId && (
                  <div id={`player-${i}-id`} tabIndex={-1} className="outline-none">
                    <ImageUploadField
                      label="Photo of a valid ID"
                      hint="Government or school ID"
                      required
                      value={player.id_photo}
                      onChange={(file) => {
                        updatePlayer(i, { id_photo: file });
                        clearError(`player_${i}_id`);
                      }}
                      error={errors[`player_${i}_id`]}
                    />
                  </div>
                )}
              </fieldset>
            ))}

            {shirtOffered && (
              <ShirtToggle
                checked={includeShirt}
                onChange={setIncludeShirt}
                price={shirtPrice}
                playerCount={players.length}
              />
            )}

            {category.requirePlayerId && <PrivacyNote />}
          </div>
        )}

        {step === "contact" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              id="contact-number"
              label="Mobile number"
              required
              hint="The organizer contacts your team here"
              error={errors.contact_number}
            >
              <Input
                id="contact-number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="09XX XXX XXXX"
                value={contactNumber}
                onChange={(e) => {
                  setContactNumber(e.target.value);
                  clearError("contact_number");
                }}
                aria-invalid={Boolean(errors.contact_number)}
                aria-describedby={describedBy("contact-number", errors.contact_number, true)}
                className={FIELD}
              />
            </Field>
            <Field
              id="contact-email"
              label="Email"
              optional
              error={errors.contact_email}
            >
              <Input
                id="contact-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={contactEmail}
                onChange={(e) => {
                  setContactEmail(e.target.value);
                  clearError("contact_email");
                }}
                aria-invalid={Boolean(errors.contact_email)}
                aria-describedby={describedBy("contact-email", errors.contact_email, false)}
                className={FIELD}
              />
            </Field>
            <Field
              id="club-name"
              label="Club name"
              required
              hint="The club your team represents"
              error={errors.club_name}
            >
              <Input
                id="club-name"
                autoComplete="organization"
                autoCapitalize="words"
                placeholder="e.g. Sunrise Pickleball Club"
                value={clubName}
                onChange={(e) => {
                  setClubName(e.target.value);
                  clearError("club_name");
                }}
                aria-invalid={Boolean(errors.club_name)}
                aria-describedby={describedBy("club-name", errors.club_name, true)}
                className={FIELD}
              />
            </Field>
            <Field
              id="club-address"
              label="Club address"
              required
              error={errors.club_address}
            >
              <Input
                id="club-address"
                autoComplete="off"
                autoCapitalize="words"
                placeholder="Barangay, City / Province"
                value={clubAddress}
                onChange={(e) => {
                  setClubAddress(e.target.value);
                  clearError("club_address");
                }}
                aria-invalid={Boolean(errors.club_address)}
                aria-describedby={describedBy("club-address", errors.club_address, false)}
                className={FIELD}
              />
            </Field>
          </div>
        )}

        {step === "payment" && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-court p-4 text-court-foreground">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-heading text-sm font-semibold uppercase tracking-[0.1em] text-court-foreground/80">
                  Amount to pay
                </span>
                <span className="scoreboard text-3xl font-bold leading-none">
                  {formatCurrency(total)}
                </span>
              </div>
              <FeeBreakdown
                perPlayerFee={perPlayerFee}
                shirtPrice={wantsShirt ? shirtPrice : 0}
                playerCount={players.length}
              />
            </div>

            {(payment.name || payment.number || payment.qr) && (
              <PaymentAccount payment={payment} />
            )}

            <div id="payment-proof" tabIndex={-1} className="outline-none">
              <ImageUploadField
                label="Proof of payment"
                hint={proofRequired ? "Screenshot of the receipt" : "Optional — you can add this later"}
                required={proofRequired}
                value={proof}
                onChange={(file) => {
                  setProof(file);
                  clearError("payment_proof");
                }}
                error={errors.payment_proof}
              />
            </div>

            <Field
              id="payment-reference"
              label="Reference number"
              optional
              hint="From your GCash receipt — helps the organizer match it"
            >
              <Input
                id="payment-reference"
                autoComplete="off"
                placeholder="e.g. 1234 567 890123"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                aria-describedby="payment-reference-hint"
                className={FIELD}
              />
            </Field>

            <PrivacyNote />
          </div>
        )}
      </section>

      {/* ---------- action bar: one primary button, pinned to the bottom
          edge on phones while the form is on screen ---------- */}
      <div className="sticky bottom-0 z-30 -mx-4 flex items-center gap-3 border-t border-border bg-popover px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-raised sm:bottom-3 sm:mx-0 sm:rounded-2xl sm:border sm:p-3">
        {feeDue ? (
          <div className="min-w-0 flex-1">
            <div className="eyebrow text-[0.7rem]">Total</div>
            <div className="scoreboard truncate text-2xl font-bold leading-none">
              {formatCurrency(total)}
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1 font-heading text-base font-bold uppercase tracking-wide text-primary">
            Free entry
          </div>
        )}
        <Button
          type="submit"
          disabled={pending}
          aria-live="polite"
          className="h-12 min-w-40 rounded-xl px-5 text-base font-semibold sm:h-12"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {sendsPhotos ? "Uploading photos…" : "Submitting…"}
            </>
          ) : isLast ? (
            <>
              Submit registration <Check className="size-4" aria-hidden />
            </>
          ) : (
            <>
              Continue <ArrowRight className="size-4" aria-hidden />
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------

/** Hint and error ids for an input, in the order a screen reader should read them. */
function describedBy(id: string, error: string | undefined, hasHint: boolean) {
  const ids = [hasHint && `${id}-hint`, error && `${id}-error`].filter(Boolean);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function Field({
  id,
  label,
  required,
  optional,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optional?: boolean;
  /** Always-visible helper line under the label. */
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="space-y-0.5">
        <Label htmlFor={id} className="text-sm font-semibold">
          {label}
          {required && (
            <span className="text-destructive" aria-hidden>
              *
            </span>
          )}
          {optional && (
            <span className="font-normal text-muted-foreground">(optional)</span>
          )}
        </Label>
        {hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      {children}
      {error && (
        <p
          id={`${id}-error`}
          className="flex items-center gap-1.5 text-sm font-medium text-destructive"
        >
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

function ShirtToggle({
  checked,
  onChange,
  price,
  playerCount,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  price: number;
  playerCount: number;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition",
        checked
          ? "border-primary/60 bg-primary/5"
          : "border-border hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          checked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
        )}
      >
        <Shirt className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">Add tournament t-shirt</span>
        <span className="block text-xs text-muted-foreground">
          {price > 0
            ? `${formatCurrency(price)} per player${playerCount > 1 ? ` · ${formatCurrency(price * playerCount)} for the team` : ""}`
            : "Free — one for each player"}
        </span>
      </span>
      {/* Switch look, native checkbox underneath for keyboard and forms. */}
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
          checked ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
    </label>
  );
}

function FeeBreakdown({
  perPlayerFee,
  shirtPrice,
  playerCount,
}: {
  perPlayerFee: number;
  shirtPrice: number;
  playerCount: number;
}) {
  const lines = [
    perPlayerFee > 0 && { label: "Entry fee", each: perPlayerFee },
    shirtPrice > 0 && { label: "T-shirt", each: shirtPrice },
  ].filter(Boolean) as { label: string; each: number }[];
  if (lines.length === 0) return null;

  return (
    <dl className="mt-3 space-y-1 border-t border-court-foreground/20 pt-3 text-sm text-court-foreground/80">
      {lines.map((line) => (
        <div key={line.label} className="flex justify-between gap-3">
          <dt>
            {line.label}
            {playerCount > 1 &&
              ` · ${formatCurrency(line.each)} × ${playerCount}`}
          </dt>
          <dd className="font-semibold text-court-foreground">
            {formatCurrency(line.each * playerCount)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function PaymentAccount({ payment }: { payment: PaymentDetails }) {
  async function copyNumber() {
    if (!payment.number) return;
    try {
      await navigator.clipboard.writeText(payment.number.replace(/\s+/g, ""));
      toast.success("GCash number copied");
    } catch {
      toast.error("Couldn't copy — please copy it manually.");
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-background/40 p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Send via GCash
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-3">
          {payment.number && (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Number</div>
                <div className="font-mono text-lg font-semibold tracking-wide">
                  {payment.number}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={copyNumber}
                className="h-10 rounded-xl"
              >
                <Copy className="size-4" /> Copy
              </Button>
            </div>
          )}
          {payment.name && (
            <div>
              <div className="text-xs text-muted-foreground">Account name</div>
              <div className="font-medium">{payment.name}</div>
            </div>
          )}
        </div>
        {payment.qr && (
          <Image
            src={payment.qr}
            alt="GCash QR code"
            width={176}
            height={176}
            unoptimized
            className="mx-auto size-44 rounded-xl bg-white object-contain p-2"
          />
        )}
      </div>
      {payment.instructions && (
        <p className="flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {payment.instructions}
        </p>
      )}
    </div>
  );
}

function PrivacyNote() {
  return (
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
      Photos are stored privately and only the tournament organizer can see
      them.
    </p>
  );
}
