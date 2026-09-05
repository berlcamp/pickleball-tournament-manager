import { LoadingOverlay } from "@/components/loading-overlay";

/**
 * Navigating between pages keeps the surrounding layout on screen and raises
 * the same veil the category switchers use, so every wait looks the same.
 */
export default function Loading() {
  return <LoadingOverlay />;
}
