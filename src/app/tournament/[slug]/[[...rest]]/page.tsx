import { notFound, redirect } from "next/navigation";
import { getTournamentByPublicRef } from "@/lib/data";

/**
 * Legacy portal URLs. Everything moved to the short form at `/{short_code}`,
 * so `/tournament/<slug>/standings` permanently redirects to `/<code>/standings`
 * — printed QR codes and links shared before the move keep working.
 */
export default async function LegacyTournamentRedirect({
  params,
}: {
  params: Promise<{ slug: string; rest?: string[] }>;
}) {
  const { slug, rest } = await params;
  const tournament = await getTournamentByPublicRef(slug);
  if (!tournament) notFound();

  // "register" was the old landing tab; the short URL serves it at the root.
  const tail = (rest ?? []).filter((segment) => segment !== "register");
  const suffix = tail.length ? `/${tail.join("/")}` : "";
  redirect(`/${tournament.short_code}${suffix}`);
}
