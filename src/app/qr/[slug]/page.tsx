import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getTournamentByPublicRef } from "@/lib/data";
import { QrPoster } from "@/components/public/qr-poster";

export const dynamic = "force-dynamic";

export default async function TournamentQrPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournamentByPublicRef(slug);
  if (!tournament) notFound();

  // Build the absolute URL of the public page from the incoming request host.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  // Short public link: lands on Registration, other tabs one tap away.
  const url = `${proto}://${host}/${tournament.short_code}`;

  return <QrPoster url={url} name={tournament.name} />;
}
