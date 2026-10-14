"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { updatePaymentSettings } from "@/actions/registration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, ImageIcon, Loader2, Upload, Wallet, X } from "lucide-react";
import type { Tournament } from "@/types";

const BUCKET = "pickleball-tournament";

/**
 * Tournament-wide payment account. One GCash account collects for every
 * category; the fee itself is set per category in the registration settings.
 */
export function PaymentSettings({ tournament }: { tournament: Tournament }) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(tournament.payment_name ?? "");
  const [number, setNumber] = useState(tournament.payment_number ?? "");
  const [qr, setQr] = useState(tournament.payment_qr ?? "");
  const [instructions, setInstructions] = useState(
    tournament.payment_instructions ?? "",
  );

  async function uploadQr(file: File) {
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
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `payment-qr/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from(BUCKET).getPublicUrl(path);
      setQr(publicUrl);
      toast.success("QR uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function save() {
    startTransition(async () => {
      const res = await updatePaymentSettings(tournament.id, {
        payment_name: name,
        payment_number: number,
        payment_qr: qr,
        payment_instructions: instructions,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Payment details saved");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="size-5" />
        </span>
        <div>
          <h2 className="font-heading text-2xl font-bold">Payment details</h2>
          <p className="text-sm text-muted-foreground">
            One GCash account for the whole tournament, shown to teams who owe
            a fee. Set the fee itself per category under Registration.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="pay-number">GCash number</Label>
          <Input
            id="pay-number"
            placeholder="0917 123 4567"
            inputMode="tel"
            value={number}
            onChange={(e) => setNumber(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pay-name">Account name</Label>
          <Input
            id="pay-name"
            placeholder="Juan Dela Cruz"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pay-instructions">
          Instructions <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="pay-instructions"
          rows={2}
          placeholder="Put your team name in the message when you send payment."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label>
          Payment QR <span className="text-muted-foreground">(optional)</span>
        </Label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadQr(file);
          }}
        />
        {qr ? (
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <Image
              src={qr}
              alt="Payment QR"
              width={96}
              height={96}
              unoptimized
              className="size-24 rounded-lg bg-white object-contain p-1"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
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
                variant="ghost"
                size="icon-sm"
                onClick={() => setQr("")}
                aria-label="Remove QR"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="flex h-24 w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border text-muted-foreground outline-none transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
          >
            {uploading ? (
              <>
                <Loader2 className="size-5 animate-spin text-primary" />
                <span className="text-sm">Uploading…</span>
              </>
            ) : (
              <>
                <ImageIcon className="size-5 text-primary" />
                <span className="text-sm font-medium">Upload your GCash QR</span>
                <span className="text-xs">Players can scan it to pay</span>
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-end">
        <span
          aria-live="polite"
          className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground"
        >
          {saved && (
            <>
              <Check className="size-4 text-primary" /> Saved
            </>
          )}
        </span>
        <Button onClick={save} disabled={pending || uploading}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Saving…" : "Save payment details"}
        </Button>
      </div>
    </section>
  );
}
