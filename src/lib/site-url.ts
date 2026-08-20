import { headers } from "next/headers";

/**
 * Absolute origin the app is served from.
 *
 * Link previews on Facebook, Messenger and Viber are built by a crawler that
 * never runs our JS and only follows **absolute** `og:` URLs, so page metadata
 * has to name the origin explicitly even though the app itself is happy with
 * relative links. Set `NEXT_PUBLIC_SITE_URL` to the production domain; the
 * Vercel-provided host is the fallback so preview deployments still resolve.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const host =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (host) return `https://${host}`;

  return "http://localhost:3000";
}

/**
 * Origin of the request being served, falling back to `siteUrl()`.
 *
 * Preferred for link-preview metadata: it stays correct on the production
 * domain, on Vercel preview deployments and on localhost without anyone having
 * to keep an env var in sync.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return siteUrl();
  const proto =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
