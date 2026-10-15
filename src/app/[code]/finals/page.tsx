import { permanentRedirect } from "next/navigation";

/**
 * The bracket now lives on the Standings tab, above the group tables. Old
 * `/{code}/finals` links (shared before the merge) keep working, category
 * included.
 */
export default async function PublicFinalsRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { code } = await params;
  const { category } = await searchParams;
  permanentRedirect(
    `/${code}/standings${category ? `?category=${encodeURIComponent(category)}` : ""}`,
  );
}
