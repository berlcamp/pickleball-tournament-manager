import type { MetadataRoute } from "next";
import { publicClient } from "@/lib/data";
import { requestOrigin } from "@/lib/site-url";

/**
 * `sitemap.xml` — the marketing page plus every public tournament portal.
 *
 * Tournament portals are the site's real indexable content: each one is a
 * page people search for by name. They are listed with their tabs, since each
 * tab now carries its own title and canonical.
 *
 * URLs are built from the request origin because a sitemap may only list URLs
 * on the host that serves it.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = await requestOrigin();

  const entries: MetadataRoute.Sitemap = [
    {
      url: origin,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  // A sitemap must never be the reason a deploy 500s: if the database is
  // unreachable we still hand back the marketing page.
  try {
    const supabase = await publicClient();
    const { data } = await supabase
      .from("tournaments")
      .select("short_code, slug, created_at, show_public_schedule")
      .order("created_at", { ascending: false })
      .limit(5000);

    for (const t of data ?? []) {
      const code = t.short_code ?? t.slug;
      if (!code) continue;
      const lastModified = t.created_at ? new Date(t.created_at) : undefined;
      const base = `${origin}/${code}`;

      entries.push({
        url: base,
        lastModified,
        changeFrequency: "daily",
        priority: 0.8,
      });
      const tabs = ["standings", "finals"];
      if (t.show_public_schedule) tabs.push("schedule");
      for (const tab of tabs) {
        entries.push({
          url: `${base}/${tab}`,
          lastModified,
          changeFrequency: "daily",
          priority: 0.6,
        });
      }
    }
  } catch {
    // Fall through with just the marketing page.
  }

  return entries;
}
