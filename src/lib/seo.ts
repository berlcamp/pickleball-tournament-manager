/**
 * The site's own name and pitch, shared by the root layout and the marketing
 * page.
 *
 * They live here because Next.js *replaces* `openGraph` when a page declares
 * one instead of merging it with the layout's, so any page that needs a single
 * og field has to restate the whole object — and every copy has to say the
 * same thing.
 */
export const SITE_NAME = "PicklePro by Sortbrite";
export const SITE_TITLE = "PicklePro by Sortbrite — Pickleball Tournament Manager";
export const SITE_DESCRIPTION =
  "Run pickleball tournaments with round robin groups, finals brackets, smart court scheduling, online registration and live public standings.";
