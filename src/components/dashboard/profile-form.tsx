"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/actions/tournaments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ProfileForm({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  const [name, setName] = useState(fullName);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateProfile({ full_name: name });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Profile updated");
    });
  }

  return (
    <div className="glass max-w-lg space-y-5 rounded-2xl p-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={email} disabled />
        <p className="text-xs text-muted-foreground">
          Signed in with Google. Email cannot be changed.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="name">Display name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <Button onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </div>
  );
}
