import Link from "next/link";
import { LogIn } from "lucide-react";

/**
 * Footer for the no-login pages. Players never need an account, but the
 * organiser reading their own portal does — this is the only way in from here.
 */
export function PublicFooter() {
  return (
    <footer className="mt-10 border-t border-white/10 py-8">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-4 text-center sm:px-6">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <LogIn className="size-4" /> Sign in to Sortbrite
        </Link>
        <p className="text-xs text-muted-foreground">
          Powered by{" "}
          <Link href="/" className="hover:text-foreground">
            PicklePro by Sortbrite
          </Link>
        </p>
      </div>
    </footer>
  );
}
