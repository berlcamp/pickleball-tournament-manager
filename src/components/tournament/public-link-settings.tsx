"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateShortCode } from "@/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SHORT_CODE_MAX,
  normalizeShortCode,
  shortCodeProblem,
} from "@/lib/short-code";
import { Check, Copy, Link2 } from "lucide-react";

/**
 * The tournament's public link. It sits at the domain root — sortbrite.com/ab3kd
 * — so it fits on a poster; the organizer can swap the generated code for
 * something like "ozamiz2026".
 */
export function PublicLinkSettings({
  tournamentId,
  shortCode,
  origin,
}: {
  tournamentId: string;
  shortCode: string;
  /** Absolute site origin, resolved server-side from the request host. */
  origin: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [value, setValue] = useState(shortCode);
  const [copied, setCopied] = useState(false);

  const normalized = normalizeShortCode(value);
  const problem = normalized === shortCode ? null : shortCodeProblem(normalized);
  const dirty = normalized !== shortCode;
  const displayHost = origin.replace(/^https?:\/\//, "");

  function save() {
    startTransition(async () => {
      const res = await updateShortCode(tournamentId, { short_code: normalized });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Public link updated");
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${origin}/${shortCode}`);
      setCopied(true);
      toast.success("Link copied");
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select the link and copy manually.");
    }
  }

  return (
    <div className="glass space-y-4 rounded-2xl p-6">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          <Link2 className="size-4 text-primary" />
          Public link
        </h3>
        <p className="text-sm text-muted-foreground">
          Where players register and follow results. Short enough to print on a
          poster or read out loud.
        </p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/40 p-3 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate text-sm">
          <span className="text-muted-foreground">{displayHost}/</span>
          <span className="font-semibold text-primary">{shortCode}</span>
        </code>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="short-code">Customise the link</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg border border-input px-2.5">
            <span className="shrink-0 text-sm text-muted-foreground">
              {displayHost}/
            </span>
            <Input
              id="short-code"
              value={value}
              maxLength={SHORT_CODE_MAX}
              autoComplete="off"
              spellCheck={false}
              onChange={(e) => setValue(e.target.value)}
              className="border-0 px-0 focus-visible:ring-0"
              aria-invalid={Boolean(problem)}
            />
          </div>
          <Button
            onClick={save}
            disabled={pending || !dirty || Boolean(problem)}
            className="sm:w-auto"
          >
            {pending ? "Saving…" : "Save link"}
          </Button>
        </div>
        {problem ? (
          <p className="text-xs text-destructive">{problem}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Lowercase letters, numbers and hyphens. Changing this stops the
            previous short link from working.
          </p>
        )}
      </div>
    </div>
  );
}
