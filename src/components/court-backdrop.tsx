import { cn } from "@/lib/utils";


/**
 * A pickleball court seen from above, stretched to fill the header: the
 * outer lines, the net across the middle, the two kitchens (non-volley
 * zones, 7 ft either side of a 44 ft court) tinted, and the centre lines
 * splitting the service boxes. Strokes don't scale, so the lines stay crisp
 * at any header size. Decorative only — drop it inside a `relative isolate`
 * box with a `bg-court` background.
 */
export function CourtBackdrop({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 44 20"
      preserveAspectRatio="none"
      className={cn(
        "pointer-events-none absolute inset-2.5 -z-10 size-[calc(100%-1.25rem)] text-court-foreground sm:inset-3.5 sm:size-[calc(100%-1.75rem)]",
        className,
      )}
    >
      {/* Kitchens */}
      <rect x="15" y="0" width="14" height="20" className="fill-current opacity-[0.06]" />
      <g
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
      >
        {/* Boundary */}
        <rect x="0" y="0" width="44" height="20" vectorEffect="non-scaling-stroke" />
        {/* Kitchen lines */}
        <line x1="15" y1="0" x2="15" y2="20" vectorEffect="non-scaling-stroke" />
        <line x1="29" y1="0" x2="29" y2="20" vectorEffect="non-scaling-stroke" />
        {/* Centre lines: baseline to kitchen on each side */}
        <line x1="0" y1="10" x2="15" y2="10" vectorEffect="non-scaling-stroke" />
        <line x1="29" y1="10" x2="44" y2="10" vectorEffect="non-scaling-stroke" />
      </g>
      {/* The net, in ball color */}
      <line
        x1="22"
        y1="-1"
        x2="22"
        y2="21"
        stroke="var(--ball)"
        strokeOpacity="0.55"
        strokeWidth="3"
        strokeDasharray="2 4"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
