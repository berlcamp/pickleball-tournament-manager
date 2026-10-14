"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Loader2, UserRound } from "lucide-react";

export function ProfileForm({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  const [name, setName] = useState(fullName);
  const [savedName, setSavedName] = useState(fullName);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = name.trim() !== savedName.trim();
  const empty = !name.trim();

  function save() {
    startTransition(async () => {
      const res = await updateProfile({ full_name: name });
      if (!res.ok) { toast.error(res.error); return; }
      setSavedName(name);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!empty) save();
      }}
      className="max-w-lg space-y-5 rounded-2xl border border-border bg-card p-5 shadow-card sm:p-6"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <UserRound className="size-5" />
        </span>
        <div>
          <h2 className="font-heading text-2xl font-bold">Profile</h2>
          <p className="text-sm text-muted-foreground">
            Signed in with Google.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
        <p className="text-xs text-muted-foreground">
          Comes from your Google account, so it can&apos;t be changed here.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="name">Display name</Label>
        <Input
          id="name"
          value={name}
          autoComplete="name"
          aria-invalid={empty}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
        <p
          className={
            empty ? "text-xs text-destructive" : "text-xs text-muted-foreground"
          }
        >
          {empty ? "Enter the name people know you by." : "Shown to your co-organisers."}
        </p>
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
        <Button type="submit" disabled={pending || empty || !dirty}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
