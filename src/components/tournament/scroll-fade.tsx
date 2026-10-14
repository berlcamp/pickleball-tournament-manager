"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A horizontal scroller whose edges fade out while there is more to see that
 * way. Wide tables and brackets scroll inside this box rather than pushing the
 * whole page sideways on a phone, and the fade is the cue that they scroll at
 * all — a plain `overflow-x-auto` gives no hint on touch screens, which hide
 * scrollbars.
 *
 * The fade is a mask, not an overlay gradient, so it works on any surface
 * (card, page background, dark mode) without knowing that surface's color.
 */
export function ScrollFade({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 1;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
      setEdges((prev) =>
        prev.left === left && prev.right === right ? prev : { left, right },
      );
    };
    el.addEventListener("scroll", update, { passive: true });
    // ResizeObserver also fires once on observe, which takes the first reading.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  const mask =
    edges.left || edges.right
      ? `linear-gradient(to right, ${edges.left ? "transparent 0, black 2.5rem" : "black 0"}, ${edges.right ? "black calc(100% - 2.5rem), transparent 100%" : "black 100%"})`
      : undefined;

  return (
    <div
      ref={ref}
      className={cn("overflow-x-auto overscroll-x-contain", className)}
      style={mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined}
    >
      {children}
    </div>
  );
}
