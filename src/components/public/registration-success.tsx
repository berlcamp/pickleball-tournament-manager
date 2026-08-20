"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { RegistrationCategory } from "@/components/public/registration-types";
import { CheckCircle2, Copy, ExternalLink, TriangleAlert } from "lucide-react";

/**
 * Confirmation screen. The reference code is the team's only credential, so
 * this screen makes copying and saving it the obvious next action.
 */
export function RegistrationSuccess({
  referenceCode,
  category,
  paidUpfront,
}: {
  referenceCode: string;
  category: RegistrationCategory;
  paidUpfront: boolean;
}) {
  const statusPath = `/r/${referenceCode}`;

  // Resolved on click rather than on render: `window` is unavailable during
  // SSR, and reading it in an effect would only cause an extra render.
  const statusUrl = () => `${window.location.origin}${statusPath}`;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy — please select and copy manually.");
    }
  }

  const owesPayment = category.fee > 0 && !paidUpfront;

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-6 text-center sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary/15">
          <CheckCircle2 className="size-7 text-primary" />
        </div>
        <h2 className="mt-4 text-xl font-bold sm:text-2xl">
          Registration submitted
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your entry for <span className="font-medium text-foreground">{category.name}</span> is
          now waiting for the organizer&apos;s review.
        </p>

        <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Your reference code
          </div>
          <div className="mt-1.5 font-mono text-2xl font-bold tracking-[0.15em] text-primary sm:text-3xl">
            {referenceCode}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              variant="outline"
              onClick={() => copy(referenceCode, "Reference code")}
            >
              <Copy className="size-4" /> Copy code
            </Button>
            <Button onClick={() => copy(statusUrl(), "Status link")}>
              <Copy className="size-4" /> Copy status link
            </Button>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-3 text-left text-xs text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            Save this link — it is the only way to check your status
            {owesPayment ? " and upload your proof of payment" : ""}. Anyone
            with the link can view this registration, so keep it to your team.
          </span>
        </div>

        <Button asChild variant="secondary" className="mt-4">
          <Link href={statusPath}>
            Open my registration <ExternalLink className="size-4" />
          </Link>
        </Button>
      </div>

      <div className="glass rounded-2xl p-5 sm:p-6">
        <h3 className="font-semibold">What happens next</h3>
        <ol className="mt-3 space-y-3 text-sm text-muted-foreground">
          <Step n={1} done>
            Your team details were received.
          </Step>
          <Step n={2}>
            The organizer reviews your entry
            {category.fee > 0 ? " and confirms your payment" : ""}.
          </Step>
          <Step n={3}>
            Once approved, your team appears in the brackets and schedule.
          </Step>
        </ol>

        {owesPayment && (
          <p className="mt-4 rounded-xl border border-white/10 bg-background/40 p-3 text-xs text-muted-foreground">
            Fee due: <span className="font-semibold text-foreground">{formatCurrency(category.fee)}</span>.
            Pay anytime and upload your receipt from your status link above.
          </p>
        )}
      </div>
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
        className={
          done
            ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
            : "flex size-6 shrink-0 items-center justify-center rounded-full border border-white/15 text-xs font-bold"
        }
      >
        {done ? "✓" : n}
      </span>
      <span className="pt-0.5">{children}</span>
    </li>
  );
}
