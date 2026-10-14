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
        <label
          htmlFor="lookup-code"
          className="block font-heading text-lg font-bold uppercase tracking-wide"
        >
          Already registered?
        </label>
        <p id="lookup-code-hint" className="text-sm text-muted-foreground">
          Enter your reference code to check your status or upload a payment.
        </p>
        <Input
          id="lookup-code"
          placeholder="PKL-XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="h-12 rounded-xl font-mono text-base uppercase tracking-wider sm:h-11"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby="lookup-code-hint"
        />
      </div>
      <Button
        type="submit"
        variant="outline"
        className="h-12 rounded-xl sm:h-11"
      >
        <Search className="size-4" aria-hidden /> Check status
      </Button>
    </form>
  );
}
