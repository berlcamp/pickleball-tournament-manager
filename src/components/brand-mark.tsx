import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The Sortbrite wordmark: a court-green tile holding a lime ball, then the
 * name in the condensed sports face. Shared by the dashboard and the portal so
 * both headers carry the same identity.
 */
export function BrandMark({
  href = "/",
  subtitle = null,
  className,
}: {
  href?: string;
  subtitle?: string | null;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span className="relative grid size-9 place-items-center overflow-hidden rounded-xl bg-court shadow-sm">
        {/* The ball, with the holes a pickleball has. */}
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <circle cx="12" cy="12" r="9" className="fill-ball" />
          <g className="fill-ball-foreground/45">
            <circle cx="9" cy="8.5" r="1.3" />
            <circle cx="14.5" cy="9" r="1.3" />
            <circle cx="8" cy="14" r="1.3" />
            <circle cx="13" cy="14.5" r="1.3" />
            <circle cx="16.5" cy="13.5" r="1" />
          </g>
        </svg>
      </span>
      <span className="flex items-baseline gap-2">
        <span className="font-heading text-xl font-bold uppercase leading-none tracking-wide">
          Sort<span className="text-primary">brite</span>
        </span>
        {subtitle && (
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {subtitle}
          </span>
        )}
      </span>
    </Link>
  );
}
