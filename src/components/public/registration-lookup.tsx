"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeReferenceCode } from "@/lib/registration-code";
import { Search } from "lucide-react";

/** "Already registered?" box — turns a reference code into its status page. */
export function RegistrationLookup() {
  const router = useRouter();
  const [code, setCode] = useState("");

  function go(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeReferenceCode(code);
    if (!normalized) {
      toast.error("That doesn't look like a reference code (PKL-XXXX-XXXX).");
      return;
    }
    router.push(`/r/${normalized}`);
  }

  return (
    <form
      onSubmit={go}
      className="glass flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-end"
    >
      <div className="flex-1 space-y-1.5">
        <label htmlFor="lookup-code" className="text-sm font-medium">
          Already registered?
        </label>
        <p className="text-xs text-muted-foreground">
          Enter your reference code to check your status or upload a payment.
        </p>
        <Input
          id="lookup-code"
          placeholder="PKL-XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="font-mono uppercase tracking-wider"
          autoComplete="off"
        />
      </div>
      <Button type="submit" variant="outline" className="sm:mb-0">
        <Search className="size-4" /> Check status
      </Button>
    </form>
  );
}
