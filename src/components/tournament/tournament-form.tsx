"use client";

import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  tournamentSchema,
  createTournamentSchema,
  type CreateTournamentInput,
} from "@/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Check,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { createTournament, updateTournament } from "@/actions/tournaments";
import { TournamentFormatInfo } from "@/components/tournament/tournament-format-info";

export function TournamentForm({
  tournamentId,
  defaults,
}: {
  tournamentId?: string;
  defaults?: Partial<CreateTournamentInput>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  // A quiet "Saved" beside the button after an edit lands, cleared after a
  // moment — the toast alone is easy to miss on a long settings page.
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(tournamentId);

  const BANNER_BUCKET = "pickleball-tournament";

  async function handleBannerUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be 5MB or smaller.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `banners/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BANNER_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from(BANNER_BUCKET).getPublicUrl(path);
      form.setValue("banner", publicUrl, { shouldDirty: true });
      toast.success("Banner uploaded");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload banner",
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const form = useForm<CreateTournamentInput>({
    resolver: zodResolver(
      isEdit ? tournamentSchema : createTournamentSchema,
    ) as unknown as Resolver<CreateTournamentInput>,
    defaultValues: {
      name: defaults?.name ?? "",
      description: defaults?.description ?? "",
      location: defaults?.location ?? "",
      start_date: defaults?.start_date ?? "",
      banner: defaults?.banner ?? "",
      show_public_schedule: defaults?.show_public_schedule ?? true,
      categories: defaults?.categories ?? [{ name: "", event_date: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "categories",
  });

  const bannerUrl = form.watch("banner");
  const showPublicSchedule = form.watch("show_public_schedule");

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
      className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6"
      noValidate
    >
      {isEdit && (
        <div>
          <h2 className="font-heading text-2xl font-bold">Details</h2>
          <p className="text-sm text-muted-foreground">
            What players see at the top of your public page.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="name">Tournament name</Label>
        <Input
          id="name"
          placeholder="Summer Slam 2026"
          aria-invalid={Boolean(errors.name)}
          {...form.register("name")}
        />
        {errors.name && (
          <p className="text-xs text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="location">Venue</Label>
          <Input
            id="location"
            placeholder="City Sports Center"
            {...form.register("location")}
          />
          <p className="text-xs text-muted-foreground">
            Optional. Shown on the public page.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" type="date" {...form.register("start_date")} />
          <p className="text-xs text-muted-foreground">
            Optional. Each category can have its own day.
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Banner image</Label>
        <input type="hidden" {...form.register("banner")} />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleBannerUpload(file);
          }}
        />
        {bannerUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-border">
            <Image
              src={bannerUrl}
              alt="Tournament banner"
              width={1200}
              height={400}
              unoptimized
              className="h-40 w-full object-cover"
            />
            <div className="absolute right-2 top-2 flex gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                Replace
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon-sm"
                aria-label="Remove banner"
                onClick={() =>
                  form.setValue("banner", "", { shouldDirty: true })
                }
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-muted-foreground outline-none transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-sm">Uploading…</span>
              </>
            ) : (
              <>
                <span className="grid size-11 place-items-center rounded-full bg-primary/10 text-primary">
                  <ImageIcon className="size-5" />
                </span>
                <span className="text-sm font-medium">
                  Tap to upload a banner
                </span>
                <span className="text-xs">PNG or JPG, up to 5MB</span>
              </>
            )}
          </button>
        )}
        <p className="text-xs text-muted-foreground">
          Optional. It becomes the preview picture when your link is shared on
          Facebook or Messenger.
        </p>
        {errors.banner && (
          <p className="text-xs text-destructive">{errors.banner.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={3}
          placeholder="Tell players about this tournament…"
          {...form.register("description")}
        />
      </div>

      <label
        htmlFor="show_public_schedule"
        className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border p-4"
      >
        <span>
          <span className="block text-sm font-medium">
            Show the schedule on the public page
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            When off, visitors who open the Schedule tab see &quot;The match
            schedule is currently unavailable&quot;.
          </span>
        </span>
        <Switch
          id="show_public_schedule"
          checked={showPublicSchedule}
          onCheckedChange={(checked) =>
            form.setValue("show_public_schedule", checked, {
              shouldDirty: true,
            })
          }
        />
      </label>

      {!isEdit && (
        <div className="space-y-3 border-t border-border pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="font-heading text-xl font-bold">Categories</h2>
              <p className="text-sm text-muted-foreground">
                Each category is its own mini-tournament (teams, groups,
                finals) and is played on its own day.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => append({ name: "", event_date: "" })}
            >
              <Plus className="size-4" /> Add category
            </Button>
          </div>

          <TournamentFormatInfo />

          {fields.map((field, i) => {
            const nameError = errors.categories?.[i]?.name?.message;
            return (
              <div
                key={field.id}
                className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-3 sm:flex-row sm:items-start"
              >
                <span className="scoreboard hidden size-11 shrink-0 place-items-center rounded-lg bg-court text-lg font-bold text-court-foreground sm:grid sm:size-9">
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
                    Day <span className="text-muted-foreground">(optional)</span>
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
                    <span className="sm:hidden">Remove category</span>
                  </Button>
                )}
              </div>
            );
          })}
          {errors.categories?.message && (
            <p className="text-xs text-destructive">
              {errors.categories.message}
            </p>
          )}
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
          disabled={pending || uploading}
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
