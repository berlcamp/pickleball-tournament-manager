import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

/**
 * Top bar of every no-login page. A fixed `h-14` so the portal tabs can stick
 * directly beneath it (`top-14`) without measuring anything.
 */
export function PublicHeader({
  width = "max-w-5xl",
}: {
  width?: "max-w-5xl" | "max-w-3xl";
}) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur-md">
      <div
        className={cn(
          "mx-auto flex h-full items-center justify-between gap-3 px-4 sm:px-6",
          width,
        )}
      >
        <BrandMark />
        <ThemeToggle />
      </div>
    </header>
  );
}
