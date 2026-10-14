"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, Copy, Check } from "lucide-react";
import { toast } from "sonner";

export function QrShare({
  path,
  label = "Share",
}: {
  path: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;

  function copy() {
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <QrCode className="size-4" /> {label}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-bold">
            {label}
          </DialogTitle>
          <DialogDescription>
            Point a phone camera at the code, or copy the link to post it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-card">
            <QRCodeCanvas value={url} size={200} />
          </div>
          <div className="flex w-full gap-2">
            <Input
              readOnly
              value={url}
              aria-label="Link"
              onFocus={(e) => e.currentTarget.select()}
              className="text-xs"
            />
            <Button onClick={copy} className="shrink-0">
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
