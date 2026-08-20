"use client";

import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
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
import { Plus, Trash2, Upload, X, ImageIcon } from "lucide-react";
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
      categories: defaults?.categories ?? [{ name: "" }],
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
        router.refresh();
      } else {
        router.push(`/dashboard/tournaments/${res.data}`);
      }
    });
  }

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="glass space-y-5 rounded-2xl p-6"
    >
      <div className="space-y-2">
        <Label htmlFor="name">Tournament name</Label>
        <Input id="name" placeholder="Summer Slam 2026" {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">
            {form.formState.errors.name.message}
          </p>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            placeholder="City Sports Center"
            {...form.register("location")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="start_date">Start date</Label>
          <Input id="start_date" type="date" {...form.register("start_date")} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Banner image (optional)</Label>
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
          <div className="relative overflow-hidden rounded-xl border border-white/5">
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
                <Upload className="size-4" /> Replace
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="icon"
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
            className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 text-muted-foreground transition hover:border-white/30 hover:text-foreground disabled:opacity-60"
          >
            {uploading ? (
              <span className="text-sm">Uploading…</span>
            ) : (
              <>
                <ImageIcon className="size-6" />
                <span className="text-sm">Click to upload a banner image</span>
                <span className="text-xs">PNG or JPG, up to 5MB</span>
              </>
            )}
          </button>
        )}
        {form.formState.errors.banner && (
          <p className="text-xs text-destructive">
            {form.formState.errors.banner.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          rows={3}
          placeholder="Tell players about this tournament…"
          {...form.register("description")}
        />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/5 p-3">
        <div>
          <Label htmlFor="show_public_schedule">Show schedule on public page</Label>
          <p className="text-xs text-muted-foreground">
            When off, visitors who open the Schedule tab will see &quot;The
            match schedule is currently unavailable&quot;.
          </p>
        </div>
        <Switch
          id="show_public_schedule"
          checked={showPublicSchedule}
          onCheckedChange={(checked) =>
            form.setValue("show_public_schedule", checked, {
              shouldDirty: true,
            })
          }
        />
      </div>

      {!isEdit && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label>Categories</Label>
              <p className="text-xs text-muted-foreground">
                Each category is its own sub-tournament (teams, groups, finals).
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => append({ name: "" })}
            >
              <Plus className="size-4" /> Add category
            </Button>
          </div>

          <TournamentFormatInfo />

          {fields.map((field, i) => (
            <div
              key={field.id}
              className="flex flex-col gap-2 rounded-xl border border-white/5 p-3 sm:flex-row sm:items-end"
            >
              <div className="w-full space-y-1.5 sm:flex-1">
                <Label htmlFor={`cat-${i}`} className="text-xs">
                  Name
                </Label>
                <Input
                  id={`cat-${i}`}
                  placeholder="e.g. Men's Doubles"
                  {...form.register(`categories.${i}.name` as const)}
                />
              </div>
              {fields.length > 1 && (
                <div className="w-full space-y-1.5 sm:w-auto">
                  <Label className="hidden text-xs sm:block sm:invisible">
                    Remove
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="w-full sm:w-auto"
                    onClick={() => remove(i)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
          {form.formState.errors.categories && (
            <p className="text-xs text-destructive">
              {form.formState.errors.categories.message ??
                "Each category needs a name."}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>
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
