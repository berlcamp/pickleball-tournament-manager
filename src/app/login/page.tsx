"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { ArrowLeft, Loader2 } from "lucide-react";
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
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <BrandMark className="mb-6" />
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-raised">
        <div className="relative isolate bg-court px-6 pt-6 pb-8 text-court-foreground sm:px-8">
          <div className="bg-court-lines absolute inset-0 -z-10 opacity-60" aria-hidden />
          <p className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-ball">
            Organizer sign in
          </p>
          <h1 className="mt-1 text-4xl font-bold uppercase leading-[0.95] sm:text-5xl">
            Welcome back
          </h1>
          <p className="mt-3 text-sm text-court-foreground/85">
            Sign in to run and manage your pickleball tournaments.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          {params.get("error") && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-left text-sm text-destructive"
            >
              <p className="font-semibold">Authentication failed.</p>
              {params.get("message") && (
                <p className="mt-1 break-words text-xs">
                  {params.get("message")}
                </p>
              )}
              {(params.get("code") || params.get("status")) && (
                <p className="mt-1 font-mono text-[11px] opacity-80">
                  {[params.get("code"), params.get("status")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          )}

          <Button
            size="lg"
            variant="outline"
            className="h-13 w-full gap-3 rounded-xl text-base font-semibold sm:h-13"
            onClick={signIn}
            disabled={loading}
            aria-live="polite"
          >
            {loading ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <GoogleIcon />
            )}
            {loading ? "Redirecting to Google…" : "Continue with Google"}
          </Button>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Players don&apos;t need an account — open your tournament&apos;s
            link to register and follow the scores.
          </p>
        </div>
      </div>
      <Link
        href="/"
        className="mt-5 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back to home
      </Link>
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
    <svg className="size-5" viewBox="0 0 48 48" aria-hidden>
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
