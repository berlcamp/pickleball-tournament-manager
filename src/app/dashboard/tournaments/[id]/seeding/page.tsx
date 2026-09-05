import { redirect } from "next/navigation";

/**
 * Seeding was merged into the Groups tab — you seed and then draw the groups
 * in one place. Kept as a redirect so bookmarked links still land somewhere.
 */
export default async function SeedingRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { id } = await params;
  const { category } = await searchParams;
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  redirect(`/dashboard/tournaments/${id}/groups${query}`);
}
