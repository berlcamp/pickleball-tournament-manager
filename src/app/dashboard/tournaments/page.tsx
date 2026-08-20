import { redirect } from "next/navigation";

/**
 * The list moved to `/dashboard` itself. This stub keeps old bookmarks and
 * in-app links working; `/dashboard/tournaments/new` and `/[id]` are unaffected.
 */
export default function TournamentsIndexPage() {
  redirect("/dashboard");
}
