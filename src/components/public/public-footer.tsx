import Link from "next/link";
import { LogIn } from "lucide-react";
import { BrandMark } from "@/components/brand-mark";

/**
 * Footer for the no-login pages. Players never need an account, but the
 * organiser reading their own portal does — this is the only way in from here.
 */
export function PublicFooter() {
  return (
    <footer className="mt-12 border-t border-border bg-card/60 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 text-center sm:px-6">
        <BrandMark subtitle={null} />
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogIn className="size-4" aria-hidden /> Organizer? Sign in
        </Link>
        <p className="text-xs text-muted-foreground">
          Powered by{" "}
          <Link
            href="/"
            className="rounded underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            PicklePro by Sortbrite
          </Link>
        </p>
      </div>
    </footer>
  );
}
