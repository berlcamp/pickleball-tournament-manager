"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { Copy, Check, Printer } from "lucide-react";
import { toast } from "sonner";

/**
 * Full-page QR poster for a tournament's public page — meant to be opened in a
 * new tab (and optionally printed) so players can scan the link.
 */
export function QrPoster({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — please copy the link manually.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-raised print:border-0 print:shadow-none">
        <div className="relative isolate bg-court px-6 pt-6 pb-8 text-center text-court-foreground">
          <div className="bg-court-lines absolute inset-0 -z-10 opacity-60" aria-hidden />
          <p className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-ball">
            Scan to open
          </p>
          <h1 className="mt-1 text-balance text-3xl font-bold uppercase leading-[0.95] sm:text-4xl">
            {name}
          </h1>
        </div>

        <div className="flex flex-col items-center gap-5 px-6 pb-6">
          <div className="-mt-5 rounded-2xl bg-white p-4 shadow-card">
            <QRCodeCanvas value={url} size={240} marginSize={2} />
          </div>

          <p className="break-all text-center font-mono text-sm text-muted-foreground">
            {url}
          </p>

          <div className="flex w-full gap-2 print:hidden">
            <Button size="lg" className="flex-1" onClick={copy}>
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? "Copied!" : "Copy link"}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={() => window.print()}
            >
              <Printer className="size-4" aria-hidden /> Print
            </Button>
          </div>

          <BrandMark subtitle={null} className="pt-1" />
        </div>
      </div>
    </div>
  );
}
