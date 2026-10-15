import { redirect } from "next/navigation";

/**
 * Results was folded into the other tabs — the podium and bracket are on
 * Finals, the group tables on Group Stage. Old links land on Finals.
 */
export default async function ResultsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { id } = await params;
  const { category } = await searchParams;
  redirect(
    `/dashboard/tournaments/${id}/finals${category ? `?category=${encodeURIComponent(category)}` : ""}`,
  );
}
