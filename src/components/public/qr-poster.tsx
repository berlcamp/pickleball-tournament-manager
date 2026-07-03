"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Copy, Check, Printer } from "lucide-react";
import { toast } from "sonner";

/**
 * Full-page QR poster for a tournament's public page — meant to be opened in a
 * new tab (and optionally printed) so players can scan the link.
 */
export function QrPoster({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass flex w-full max-w-md flex-col items-center gap-6 rounded-2xl p-8 text-center">
        <div>
          <p className="text-sm text-muted-foreground">Scan to open</p>
          <h1 className="text-2xl font-bold">{name}</h1>
        </div>

        <div className="rounded-2xl bg-white p-5">
          <QRCodeCanvas value={url} size={260} marginSize={2} />
        </div>

        <p className="break-all text-xs text-muted-foreground">{url}</p>

        <div className="flex w-full gap-2 print:hidden">
          <Button variant="secondary" className="flex-1" onClick={copy}>
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            Copy link
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => window.print()}
          >
            <Printer className="size-4" /> Print
          </Button>
        </div>
      </div>
    </div>
  );
}
