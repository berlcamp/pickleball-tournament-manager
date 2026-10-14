"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RegistrationCategory } from "@/components/public/registration-types";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Link2,
  TriangleAlert,
} from "lucide-react";

/**
 * Confirmation screen. The reference code is the team's only credential, so
 * this screen makes copying and saving it the obvious next action.
 */
export function RegistrationSuccess({
  referenceCode,
  category,
  paidUpfront,
  amountDue,
}: {
  referenceCode: string;
  category: RegistrationCategory;
  paidUpfront: boolean;
  /** Category fee plus any shirts the team added. */
  amountDue: number;
}) {
  const statusPath = `/r/${referenceCode}`;
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  // Resolved on click rather than on render: `window` is unavailable during
  // SSR, and reading it in an effect would only cause an extra render.
  const statusUrl = () => `${window.location.origin}${statusPath}`;

  async function copy(which: "code" | "link") {
    const value = which === "code" ? referenceCode : statusUrl();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      toast.success(which === "code" ? "Reference code copied" : "Status link copied");
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 2000);
    } catch {
      toast.error("Couldn't copy — please select and copy manually.");
    }
  }

  const owesPayment = amountDue > 0 && !paidUpfront;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="relative isolate bg-court px-5 py-7 text-center text-court-foreground sm:py-9">
          <div className="bg-court-lines absolute inset-0 -z-10 opacity-60" aria-hidden />
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-ball text-ball-foreground">
            <CheckCircle2 className="size-8" aria-hidden />
          </div>
          <h2 className="mt-4 text-3xl font-bold uppercase leading-none sm:text-4xl">
            You&apos;re registered!
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-court-foreground/85">
            Your entry for{" "}
            <span className="font-semibold text-court-foreground">
              {category.name}
            </span>{" "}
            is waiting for the organizer&apos;s review.
          </p>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="text-center">
            <div className="eyebrow">Your reference code</div>
            <button
              type="button"
              onClick={() => copy("code")}
              aria-label={`Reference code ${referenceCode}. Tap to copy.`}
              className="mt-2 w-full rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 px-3 py-4 font-mono text-[1.6rem] font-bold tracking-[0.12em] text-foreground transition-colors duration-150 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-3xl"
            >
              {referenceCode}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              size="lg"
              onClick={() => copy("code")}
              className="w-full"
            >
              {copied === "code" ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied === "code" ? "Copied!" : "Copy code"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => copy("link")}
              className="w-full"
            >
              {copied === "link" ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Link2 className="size-4" aria-hidden />
              )}
              {copied === "link" ? "Copied!" : "Copy status link"}
            </Button>
          </div>

          <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span>
              Save this code — it&apos;s the only way to check your status
              {owesPayment ? " and upload your proof of payment" : ""}. Anyone
              with the link can view this registration, so keep it to your
              team.
            </span>
          </div>

          <Button asChild size="lg" variant="secondary" className="w-full">
            <Link href={statusPath}>
              Open my registration <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </section>

      <section className="glass rounded-2xl p-5 sm:p-6">
        <h3 className="font-heading text-lg font-bold uppercase tracking-wide">
          What happens next
        </h3>
        <ol className="mt-3 space-y-3 text-sm">
          <Step n={1} done>
            Your team details were received.
          </Step>
          <Step n={2}>
            The organizer reviews your entry
            {amountDue > 0 ? " and confirms your payment" : ""}.
          </Step>
          <Step n={3}>
            Once approved, your team appears in the brackets and schedule.
          </Step>
        </ol>

        {owesPayment && (
          <p className="mt-4 flex items-baseline justify-between gap-3 rounded-xl bg-muted p-3 text-sm">
            <span className="text-muted-foreground">
              Fee due — pay anytime and upload the receipt from your status
              link.
            </span>
            <span className="scoreboard shrink-0 text-xl font-bold">
              {formatCurrency(amountDue)}
            </span>
          </p>
        )}
      </section>
    </div>
  );
}

function Step({
  n,
  done,
  children,
}: {
  n: number;
  done?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={cn(
          "scoreboard grid size-7 shrink-0 place-items-center rounded-full text-sm font-bold",
          done
            ? "bg-primary text-primary-foreground"
            : "border border-border text-muted-foreground",
        )}
      >
        {done ? <Check className="size-4" aria-label="Done" /> : n}
      </span>
      <span className={cn("pt-1", done ? "text-foreground" : "text-muted-foreground")}>
        {children}
      </span>
    </li>
  );
}
