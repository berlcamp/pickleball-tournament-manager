import type { MetadataRoute } from "next";
import { requestOrigin } from "@/lib/site-url";

/**
 * `robots.txt`, served from the domain root.
 *
 * Everything public is crawlable: the marketing page and the tournament
 * portals at `/{short_code}` are the pages we want found. The disallow list is
 * the rest — the authed app, the OAuth callback, QR posters (an image of a
 * link we already expose) and a registrant's private status page. `/r/` is
 * already `noindex`; blocking it here keeps crawlers from fetching reference
 * codes at all.
 *
 * The origin comes from the request so the `Sitemap:` line is correct on the
 * production domain, Vercel previews and localhost alike.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await requestOrigin();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/auth/", "/dashboard", "/login", "/qr/", "/r/"],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
