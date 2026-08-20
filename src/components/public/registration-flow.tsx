"use client";

import { useState } from "react";
import { CategoryPicker } from "@/components/public/category-picker";
import { RegistrationForm } from "@/components/public/registration-form";
import { RegistrationSuccess } from "@/components/public/registration-success";
import { RegistrationLookup } from "@/components/public/registration-lookup";
import { cn } from "@/lib/utils";
import type {
  PaymentDetails,
  RegistrationCategory,
} from "@/components/public/registration-types";
import { CircleSlash } from "lucide-react";

type Step = "category" | "form" | "done";

const STEPS: { key: Step; label: string }[] = [
  { key: "category", label: "Category" },
  { key: "form", label: "Team details" },
  { key: "done", label: "Confirmation" },
];

/**
 * Three-step public registration: pick a category, fill the form for that
 * category's settings, then receive the reference code. Kept in one client
 * component so moving between steps never costs a round trip.
 */
export function RegistrationFlow({
  categories,
  totalCategories,
  payment,
}: {
  /** Only categories currently accepting entries — closed ones are filtered
   * out server-side and never rendered. */
  categories: RegistrationCategory[];
  /** How many categories the tournament has in total, so "none open yet" can
   * be told apart from "none set up yet". */
  totalCategories: number;
  payment: PaymentDetails;
}) {
  const [step, setStep] = useState<Step>("category");
  const [selected, setSelected] = useState<RegistrationCategory | null>(null);
  const [referenceCode, setReferenceCode] = useState<string | null>(null);
  const [paidUpfront, setPaidUpfront] = useState(false);

  return (
    <div className="space-y-6">
      <Stepper current={step} />

      {step === "category" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold sm:text-xl">
              Choose your category
            </h2>
            <p className="text-sm text-muted-foreground">
              {categories.length > 0
                ? `${categories.length} ${categories.length === 1 ? "category is" : "categories are"} open — each is a separate competition with its own bracket.`
                : "Each category is a separate competition with its own bracket."}
            </p>
          </div>

          {categories.length > 0 ? (
            <CategoryPicker
              categories={categories}
              onSelect={(category) => {
                setSelected(category);
                setStep("form");
              }}
            />
          ) : totalCategories === 0 ? (
            <EmptyState
              title="No categories yet"
              body="The organizer hasn't set up any categories for this tournament."
            />
          ) : (
            <EmptyState
              title="Registration is closed"
              body="No category is accepting entries right now. Check the standings and schedule tabs for the latest updates, or look up your reference code below if you already registered."
            />
          )}

          <RegistrationLookup />
        </div>
      )}

      {step === "form" && selected && (
        <RegistrationForm
          category={selected}
          payment={payment}
          onBack={() => setStep("category")}
          onSuccess={(code) => {
            setReferenceCode(code);
            setPaidUpfront(selected.requirePaymentUpfront);
            setStep("done");
          }}
        />
      )}

      {step === "done" && selected && referenceCode && (
        <RegistrationSuccess
          referenceCode={referenceCode}
          category={selected}
          paidUpfront={paidUpfront}
        />
      )}
    </div>
  );
}

function Stepper({ current }: { current: Step }) {
  const currentIndex = STEPS.findIndex((s) => s.key === current);
  return (
    <ol className="flex items-center gap-2 text-xs sm:gap-3 sm:text-sm">
      {STEPS.map((s, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                done && "bg-primary/20 text-primary",
                active && "bg-primary text-primary-foreground",
                !done && !active && "border border-border text-muted-foreground",
              )}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "truncate font-medium",
                active ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "hidden h-px flex-1 sm:block",
                  done ? "bg-primary/40" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="glass flex flex-col items-center gap-2 rounded-2xl p-8 text-center">
      <CircleSlash className="size-6 text-muted-foreground" />
      <h3 className="font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
