"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Check, Copy, Download, Printer, QrCode } from "lucide-react";

/**
 * The tournament's public link and its QR code, at the foot of Settings —
 * copy the link for a chat, save the code for a poster, or open the printable
 * page.
 */
export function ShareCard({
  url,
  code,
  name,
}: {
  url: string;
  code: string;
  name: string;
}) {
  const [copied, setCopied] = useState(false);
  const canvasWrap = useRef<HTMLDivElement>(null);

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

  function download() {
    const canvas = canvasWrap.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${name.replace(/[^\w-]+/g, "-").toLowerCase()}-qr.png`;
    a.click();
  }

  return (
    <section
      aria-labelledby="share-heading"
      className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <QrCode className="size-5" />
        </span>
        <div>
          <h2 id="share-heading" className="font-heading text-2xl font-bold">
            Share your tournament
          </h2>
          <p className="text-sm text-muted-foreground">
            Players scan the code or open the link to register and follow the
            scores.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
        <div
          ref={canvasWrap}
          className="shrink-0 rounded-2xl border border-border bg-white p-3"
        >
          {/* Rendered at 2× and shown at half size, so the saved PNG prints
              sharply. */}
          <QRCodeCanvas
            value={url}
            size={400}
            marginSize={2}
            style={{ width: 176, height: 176 }}
            aria-label={`QR code for ${url}`}
          />
        </div>

        <div className="w-full min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 p-1.5 pl-3">
            <span className="min-w-0 flex-1 truncate font-mono text-sm">
              {url}
            </span>
            <Button size="sm" onClick={copy} className="shrink-0">
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={download}>
              <Download className="size-4" aria-hidden /> Save QR image
            </Button>
            <Button asChild variant="outline">
              <Link href={`/qr/${code}`} target="_blank">
                <Printer className="size-4" aria-hidden /> Print poster
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
