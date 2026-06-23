"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { toast } from "sonner";

function LoginInner() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    try {
      const supabase = createClient();
      // Keep `redirectTo` free of query params so it matches the Supabase
      // allow-list entry exactly — a trailing `?next=` makes the glob match
      // fail and Supabase falls back to the Site URL. Carry `next` in a
      // short-lived cookie that the callback route reads instead.
      document.cookie = `auth_next=${encodeURIComponent(next)}; path=/; max-age=600; samesite=lax`;
      const redirectTo = `${window.location.origin}/auth/callback`;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) throw error;
    } catch (e) {
      toast.error("Sign-in failed. Is Supabase configured?");
      console.error(e);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="glass-strong w-full max-w-md rounded-3xl p-8 text-center">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-lg font-bold"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Trophy className="size-5" />
          </span>
          <span className="text-gradient">PicklePro</span>
        </Link>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to run and manage your pickleball tournaments.
        </p>

        {params.get("error") && (
          <div className="mt-4 rounded-lg bg-destructive/15 px-3 py-2 text-left text-sm text-destructive">
            <p className="font-medium">Authentication failed.</p>
            {params.get("message") && (
              <p className="mt-1 break-words text-xs opacity-90">
                {params.get("message")}
              </p>
            )}
            {(params.get("code") || params.get("status")) && (
              <p className="mt-1 font-mono text-[11px] opacity-70">
                {[params.get("code"), params.get("status")]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        )}

        <Button
          size="lg"
          className="mt-8 h-13 w-full gap-3 rounded-xl text-base font-semibold shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/35"
          onClick={signIn}
          disabled={loading}
        >
          <GoogleIcon />
          {loading ? "Redirecting…" : "Continue with Google"}
        </Button>

        <p className="mt-6 text-xs text-muted-foreground">
          By continuing you agree to play fair. 🏓
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44c11 0 20-9 20-20 0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7A20 20 0 0 0 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C41 36.5 44 30.8 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
