import { LoadingOverlay, PageSkeleton } from "@/components/loading-overlay";

/**
 * Navigating between pages keeps the surrounding layout on screen, shows the
 * same top bar the category switchers use, and sketches the page underneath
 * so the wait reads as "almost there" rather than "blocked".
 */
export default function Loading() {
  return (
    <>
      <LoadingOverlay />
      <PageSkeleton />
    </>
  );
}
