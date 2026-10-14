"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downscaleImage } from "@/lib/image-resize";
import { cn } from "@/lib/utils";
import { Camera, CircleAlert, Loader2, X } from "lucide-react";

const MAX_BYTES = 15 * 1024 * 1024;

/**
 * Tap-to-upload image field used for ID photos and payment receipts. Shows a
 * thumbnail preview and hands the parent a downscaled File ready to post.
 */
export function ImageUploadField({
  label,
  hint,
  required,
  value,
  onChange,
  error,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  value: File | null;
  onChange: (file: File | null) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("That photo is too large (max 15MB).");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setBusy(true);
    try {
      const { file: resized, previewUrl } = await downscaleImage(file);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return previewUrl;
      });
      onChange(resized);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function clear() {
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    onChange(null);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">
          {label}
          {required && (
            <span className="ml-0.5 text-destructive" aria-hidden>
              *
            </span>
          )}
        </span>
        {hint && (
          <span className="text-xs text-muted-foreground">{hint}</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void pick(file);
        }}
      />

      {value && preview ? (
        <div className="relative overflow-hidden rounded-xl border border-border">
          <Image
            src={preview}
            alt={label}
            width={600}
            height={400}
            unoptimized
            className="h-36 w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
            <span className="truncate text-xs text-white/90">
              {(value.size / 1024).toFixed(0)} KB
            </span>
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => inputRef.current?.click()}
              >
                Replace
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="secondary"
                onClick={clear}
                aria-label={`Remove ${label}`}
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          aria-label={`${label}${required ? " (required)" : ""}: tap to upload a photo`}
          className={cn(
            "flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed bg-muted/40 text-muted-foreground transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.99]",
            error
              ? "border-destructive/60 text-destructive"
              : "border-border hover:border-primary/60 hover:bg-primary/5 hover:text-foreground",
          )}
        >
          {busy ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              <span className="text-xs">Preparing image…</span>
            </>
          ) : (
            <>
              <span className="grid size-10 place-items-center rounded-full bg-primary text-primary-foreground">
                <Camera className="size-5" aria-hidden />
              </span>
              <span className="text-sm font-semibold text-foreground">
                Tap to upload a photo
              </span>
              <span className="text-xs">JPG or PNG, up to 15MB</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
