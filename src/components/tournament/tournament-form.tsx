"use client";

import {
  useForm,
  useFieldArray,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  tournamentSchema,
  createTournamentSchema,
  type CreateTournamentInput,
} from "@/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { createTournament, updateTournament } from "@/actions/tournaments";
import { CategoryPresets } from "@/components/tournament/category-presets";

/**
 * A tournament is a name and a venue — dates live on the categories and the
 * share image is generated, so there is nothing else to fill in. Creating one
 * also lists its first categories.
 */
export function TournamentForm({
  tournamentId,
  defaults,
}: {
  tournamentId?: string;
  defaults?: Partial<CreateTournamentInput>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // A quiet "Saved" beside the button after an edit lands, cleared after a
  // moment — the toast alone is easy to miss on a long settings page.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);
  const isEdit = Boolean(tournamentId);

  const form = useForm<CreateTournamentInput>({
    resolver: zodResolver(
      isEdit ? tournamentSchema : createTournamentSchema,
    ) as unknown as Resolver<CreateTournamentInput>,
    defaultValues: {
      name: defaults?.name ?? "",
      location: defaults?.location ?? "",
      categories: defaults?.categories ?? [{ name: "", event_date: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "categories",
  });
  const watchedCategories = useWatch({
    control: form.control,
    name: "categories",
  });
  const categoryNames = (watchedCategories ?? []).map((c) => c.name);

  // A preset fills the first empty row before adding a new one, so the blank
  // row the form opens with isn't left behind.
  function addPreset(name: string) {
    const empty = categoryNames.findIndex((n) => !n.trim());
    if (empty >= 0) {
      form.setValue(`categories.${empty}.name`, name, {
        shouldDirty: true,
        shouldValidate: form.formState.isSubmitted,
      });
    } else {
      append({ name, event_date: "" }, { shouldFocus: false });
    }
  }

  function onSubmit(values: CreateTournamentInput) {
    startTransition(async () => {
      const res = tournamentId
        ? await updateTournament(tournamentId, values)
        : await createTournament(values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(tournamentId ? "Tournament updated" : "Tournament created");
      if (tournamentId) {
        setSaved(true);
        // What was just saved becomes the new baseline, so "Unsaved changes"
        // only shows up again on the next real edit.
        form.reset(form.getValues());
      }
      // An update revalidates the workspace in the same response; only a
      // new tournament needs to move somewhere.
      if (!tournamentId) router.push(`/dashboard/tournaments/${res.data}`);
    });
  }

  const errors = form.formState.errors;
  const dirty = form.formState.isDirty;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6"
      noValidate
    >
      {isEdit && (
        <div>
          <h2 className="font-heading text-2xl font-bold">Details</h2>
          <p className="text-sm text-muted-foreground">
            Shown at the top of your public page.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="name">Tournament name</Label>
          <Input
            id="name"
            placeholder="Summer Slam 2026"
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "name-error" : undefined}
            {...form.register("name")}
          />
          {errors.name && (
            <p id="name-error" className="text-xs text-destructive">
              {errors.name.message}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">
            Venue <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="location"
            placeholder="City Sports Center"
            {...form.register("location")}
          />
        </div>
      </div>

      {!isEdit && (
        <div className="space-y-4 border-t border-border pt-5">
          <div>
            <h2 className="font-heading text-xl font-bold">Categories</h2>
            <p className="text-sm text-muted-foreground">
              Each one has its own teams, groups and finals, and its own day.
            </p>
          </div>

          <ol className="space-y-2">
            {fields.map((field, i) => {
              const nameError = errors.categories?.[i]?.name?.message;
              return (
                <li
                  key={field.id}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-start"
                >
                  <span
                    aria-hidden
                    className="scoreboard hidden size-9 shrink-0 place-items-center rounded-lg bg-court text-lg font-bold text-court-foreground sm:mt-6 sm:grid"
                  >
                    {i + 1}
                  </span>
                  <div className="w-full space-y-1.5 sm:flex-1">
                    <Label htmlFor={`cat-${i}`}>Category name</Label>
                    <Input
                      id={`cat-${i}`}
                      placeholder="e.g. Men's Doubles"
                      aria-invalid={Boolean(nameError)}
                      {...form.register(`categories.${i}.name` as const)}
                    />
                    {nameError && (
                      <p className="text-xs text-destructive">{nameError}</p>
                    )}
                  </div>
                  <div className="w-full space-y-1.5 sm:w-44">
                    <Label htmlFor={`cat-date-${i}`}>
                      Play day{" "}
                      <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id={`cat-date-${i}`}
                      type="date"
                      {...form.register(`categories.${i}.event_date` as const)}
                    />
                  </div>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive sm:mt-6 sm:size-9 sm:px-0"
                      aria-label={`Remove category ${i + 1}`}
                      onClick={() => remove(i)}
                    >
                      <Trash2 className="size-4" />
                      <span className="sm:hidden">Remove</span>
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
          {errors.categories?.message && (
            <p className="text-xs text-destructive">
              {errors.categories.message}
            </p>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full border-dashed sm:w-auto"
            onClick={() => append({ name: "", event_date: "" })}
          >
            <Plus className="size-4" /> Add another category
          </Button>
          <CategoryPresets used={categoryNames} onPick={addPreset} />
        </div>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
        {isEdit && (
          <span
            aria-live="polite"
            className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground"
          >
            {saved ? (
              <>
                <Check className="size-4 text-primary" /> Saved
              </>
            ) : dirty ? (
              "Unsaved changes"
            ) : null}
          </span>
        )}
        <Button
          type="submit"
          size={isEdit ? "default" : "lg"}
          disabled={pending || (isEdit && !dirty)}
        >
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending
            ? "Saving…"
            : tournamentId
              ? "Save changes"
              : "Create tournament"}
        </Button>
      </div>
    </form>
  );
}
