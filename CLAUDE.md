# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> ⚠️ Next.js 16 + React 19 + Tailwind v4 here. Conventions differ from older
> versions — see `AGENTS.md` and consult `node_modules/next/dist/docs/` before
> writing framework code.

## Commands

```bash
npm run dev      # dev server at http://localhost:3000
npm run build    # production build (also the type-check gate — no separate tsc script)
npm run start    # run the production build
npm run lint     # eslint (flat config, eslint.config.mjs)
```

There is **no test runner configured**. The `src/services/` engine is written
to be pure/unit-testable, but no test framework is installed yet.

Database changes are applied by running the SQL files in `supabase/migrations/`
manually in the Supabase SQL Editor (no migration CLI in this project).

## Environment & Supabase setup

Copy `.env.example` → `.env.local`. `SUPABASE_SERVICE_ROLE_KEY` is optional for
most of the app (see service-role note below) but **required for public
registration** — registrant PII has no anon RLS read policy, so that module
reads and writes exclusively through the service client. Critical, non-obvious setup step: in Supabase
**Project Settings → API → Exposed schemas**, add `pickleball`. All tables live
in a dedicated `pickleball` schema (not `public`), and every Supabase client is
constructed with `db: { schema: "pickleball" }`. Without exposing the schema the
JS client cannot read anything.

## Architecture

A pickleball tournament SaaS. The data flow is:
**Server Components / Server Actions → Supabase (Postgres + RLS) → pure engine in `src/services/`**.

### Three Supabase client paths (`src/lib/supabase/`, `src/lib/data.ts`)
- `server.ts → createClient()` — anon key, cookie-bound, RLS-enforced. Default for authed reads/writes in Server Components and actions.
- `server.ts → createServiceClient()` — service-role, **bypasses RLS**. Server-only, for public read pages and privileged ops after explicit auth checks.
- `client.ts → createClient()` — browser client for Realtime subscriptions and client components.
- `lib/data.ts → publicClient()` — returns the service client, else falls back to the anon client (public RLS `select` policies allow no-login reads). Public portal pages use this.

### Auth & sessions
- Session refresh runs in `src/proxy.ts` (Next middleware) via `lib/supabase/middleware.ts → updateSession`.
- `lib/auth.ts` — `requireUser()` (redirects to `/login`), `getProfile()`, `getTournamentRole()`.
- Google OAuth only; callback handled at `src/app/auth/callback/route.ts`.

### Server actions (`src/actions/`)
All mutations are server actions, one file per domain (tournaments, participants,
seeding, groups, groupStage, finals, schedule, members, registration). Shared conventions live
in `actions/helpers.ts` and must be followed:
- Wrap action bodies in `run()` → returns `ActionResult<T>` (`{ ok, data } | { ok: false, error }`); throw `ActionError` for user-facing failures.
- Authorize **every mutation** with `assertRole(tournamentId, minRole)`. Roles rank `viewer < scorekeeper < admin < owner` (`lib/constants.ts → roleAtLeast`). RLS is a backstop, not the primary check.
- Call `logAudit(...)` for significant actions (best-effort; never throws).
- Validate input with Zod schemas from `src/validators/` before touching the DB.
- `revalidatePath(...)` after writes that affect cached pages.

### The tournament engine (`src/services/`)
Pure, framework-free, I/O-free modules — keep them that way (no Supabase imports):
- `seeding.ts` — manual/random seeding + `assignGroups`, the Challonge-style pair-alternating group distribution
- `roundRobin.ts` — group match generation
- `standings.ts` — standings computation + tie-breaker chain (match wins → head-to-head mini-league → set wins → point differential → total points → direct head-to-head, then order left as-is). Point differential sits **above** total points on purpose: games run to a fixed target, so points-scored mostly reflects how many sets were played, not how well.
- `brackets.ts` — ranks qualifiers across groups and draws the single-elimination final stage (byes, third-place playoff, round labeling)
- `scheduler.ts` — court scheduling (intervals, court assignment; `sequential` vs equally-distributed modes). Groups are pinned to a court and play back to back — there is no rest-period setting. `buildSchedule` also takes `reserved` court/time slots, so a run covering only some groups schedules around the ones it left alone.
- `blindPairing.ts` — random partner draw for a list of individual players: one pot (anyone with anyone), or two groups paired across so a team is always one player from each
- `registration.ts` — whether a category is accepting entries (open flag, deadline, team cap, stage) and how many players a format needs

Actions/data loaders pull rows from Supabase, hand plain objects to these
functions, and persist the results. Loaders that assemble view models for
pages live in `src/lib/tournament-data.ts` and take a `SupabaseClient` so they
work with either the authed or public client.

### Routing
- `src/app/dashboard/**` — authed management UI (no side nav; `/dashboard` **is** the tournament list and `/dashboard/tournaments` redirects to it); tournament workspace is `tournaments/[id]/{registrations,participants,seeding,groups,group-stage,schedule,finals,results,settings}`.
- `src/app/[code]/**` — public, no-login portal, served from the **domain root** so links stay short (`sortbrite.com/ab3kd`). The index IS the Registration tab; siblings are standings, schedule, finals, teams/[id]. `getTournamentByPublicRef` resolves `tournaments.short_code` first and falls back to the long `slug`, so older links keep working.
- `src/app/tournament/[slug]/[[...rest]]` — redirect stub only; forwards legacy portal URLs to the short form.
- Because `/[code]` shares the top-level namespace with every real page, custom codes are checked against `RESERVED_CODES` in `src/lib/short-code.ts`. **Add any new top-level route to that set.**
- `src/app/r/[code]` — a registrant's own status page, addressed by reference code (noindex).

### Link previews (Facebook / Messenger / Viber)
`src/app/[code]/portal-metadata.ts → portalMetadata` produces the `og:` tags for
every page of the portal — the layout calls it bare, each tab calls it with its
own label. Tabs cannot simply inherit: Next.js **replaces** `openGraph` when a
page declares one instead of merging it with the layout's, so a page that sets
only a title silently loses the banner. Anything that touches `openGraph` at
page level has to restate the whole object (the marketing page does the same,
from the constants in `src/lib/seo.ts`). The tournament **banner** is the
`og:image`, linked straight to its public Supabase storage URL — untouched,
since it is the poster the organiser designed. Tournaments with no banner fall
back to a generated 1200×630 card at `src/app/[code]/og/route.tsx` (`next/og`).
That fallback is deliberately a plain route, **not** the `opengraph-image` file
convention: the convention is collected at the page level and would override
the banner set by the layout. `metadataBase` comes from the request host
(`lib/site-url.ts → requestOrigin`), so previews resolve on the production
domain, Vercel previews and localhost alike. After changing a banner, re-scrape
the link in Facebook's Sharing Debugger — FB caches previews for days.

Every other route (the marketing page, `/login`, the dashboard) falls back to
`src/app/opengraph-image.png` — the promotional card chat apps crop previews to,
with `opengraph-image.alt.txt` beside it as its alt text. The root layout
deliberately leaves `openGraph.images` unset so that file convention applies
(Next copies it onto the Twitter card too); the portal sets it and therefore
overrides. Changing the homepage thumbnail means replacing that PNG — keep it
1200×630 and re-scrape the link afterwards.

### SEO
- `src/app/robots.ts` and `src/app/sitemap.ts` are generated at request time and
  build their URLs from `requestOrigin()`, so both are correct on the production
  domain, Vercel previews and localhost without an env var. The sitemap lists the
  marketing page plus every tournament portal and its tabs; it swallows database
  errors rather than 500-ing a crawler.
- Canonicals: the marketing page claims `/`, and each portal tab claims its own
  path. Without the per-tab canonical every tab would claim the index page and
  search engines would fold them into one result.
- Anything private is `noindex`: the dashboard, `/login`, `/qr/*`, `/r/*`, and
  the schedule tab while the organiser has it hidden. `robots.txt` blocks the
  same paths.
- The marketing page emits JSON-LD (`Organization` / `WebSite` /
  `SoftwareApplication`); its `featureList` is generated from `FEATURES`, so the
  copy and the structured data cannot drift apart.
- Legacy `/tournament/<slug>` URLs use `permanentRedirect` (308), which is what
  passes their ranking to the short link.

### Public registration
Teams sign up from the portal without logging in. Settings are per category
(`format`, `registration_open`, deadline, `max_teams`, fee, whether proof of
payment is required upfront, shirt sizes, player IDs); the GCash account is
tournament-level. A submission produces a `registrations` row (+
`registration_players`) and a `PKL-XXXX-XXXX` reference code that doubles as
the status-page URL, where the team can upload payment later.
- `status` (pending/approved/disqualified/cancelled) and `payment_status`
  (unpaid/submitted/verified/refunded) move independently.
- **Approving creates the `participants` row**, so an approved team flows
  straight into seeding — and reversing an approval removes it again. Both
  directions require the category to still be `draft`.
- ID photos and receipts live in the **private** `pickleball-registrations`
  bucket and are only ever served through short-lived signed URLs
  (`lib/registration-data.ts`). Never move them to the public banner bucket.

### Realtime
Enabled on `standings`, `group_matches`, `final_matches`, `match_schedules`.
`registrations` is deliberately excluded (PII).
Public/live pages subscribe via the browser client (see `components/public/live-refresh.tsx`) and refresh on change — no polling.

### Types
- `src/types/database.ts` — Supabase `Database` type for the `pickleball` schema.
- `src/types/index.ts` — domain types (`Role`, `Tournament`, statuses, etc.).

## Conventions
- Import alias: `@/*` → `src/*`.
- UI: shadcn/ui primitives in `src/components/ui/` (configured via `components.json`); feature components in `components/tournament/`, `components/dashboard/`, `components/public/`. Tailwind v4 (no `tailwind.config`; config is in `globals.css` / `postcss.config.mjs`).
- Tournament status flow: `draft → group_stage → final_stage → completed` (`STATUS_FLOW` in `lib/constants.ts`).
- Dates are **per category**: `categories.event_date` is the day that category
  is played. It is a column, not a `settings` key — the schedule generator and
  the public portal both read it, and the portal's headline date falls back to
  the span the categories cover (`lib/format.ts → formatEventDates`) when the
  tournament has no `start_date`. A started category can still have its date
  corrected; only its name locks.
- `generateSchedule` takes an optional `group_ids`: groups within a category can
  be played on different days, so each day's groups are generated on their own
  run with their own date. Groups outside the run keep their slots and are fed
  back to `buildSchedule` as `reserved`, so nothing is double-booked. After a
  run the category's `event_date` is set to the **earliest** scheduled day.

### Tournament format (one method, two stages)
Every category runs the same Challonge-style format — there is no bracket type
to choose:
1. **Group stage** — `assignGroups` spreads seeds across groups two groups at
   a time, flipping direction per pair and per pass (verified against
   Challonge: 16 seeds / 8 groups gives A{1,10} B{2,9} C{4,11} D{3,12}…). This
   is NOT a plain serpentine and does not equalise group strength; that is
   Challonge's behaviour, matched deliberately. Round robin inside each group. The
   top `ADVANCE_PER_GROUP` (`lib/constants.ts`, currently 2) qualify. That
   constant is the single source of truth for finals generation, standings
   highlighting and knockout slot reservation; don't re-declare it locally.
2. **Final stage** — `rankQualifiers` puts every qualifier in one overall
   order, then seeds it standard-style (1 vs N) into a single-elimination
   bracket. Only the **group winners** are ranked on their own results: win
   *rate* (groups differ in size), point differential, points, then group
   index as a deterministic last resort — never a random tiebreak, because a
   redrawn bracket must be identical. Every tier below the winners is laid out
   in that **same group order, offset by a pairwise swap** (`pairSwap`), so a
   runner-up's seed is a function of how its group *winner* placed, not of its
   own record.

   This is Challonge's rule, verified against a real 8-group tournament where a
   1-2 runner-up was seeded above three 2-1 runners-up. It is intentional: the
   offset is what structurally keeps a group's winner away from its own
   runner-up in round one. Do not "fix" it by ranking runners-up on their own
   records — that reintroduces same-group first-round matches.

`avoidSameGroupFirstRound` then repairs the draw: strict seeding pairs seed N
with seed (size + 1 - N), which sometimes lands two teams from the same group
against each other, and they just played in the group stage. The repair swaps
opponents between two round-one matches, picking the swap between the
closest-ranked teams so the seeding moves as little as possible. Byes are
never swapped — a bye belongs to the top seeds. If no legal swap exists (a
tiny field), the clash is left rather than forced.

Byes are resolved when the bracket is drawn: a match with a `"BYE"` source is
inserted already `completed` with `winner_id` set, and the survivor is already
placed in the next round's match. Nobody has to score a walkover.

Before the stage ends the Finals tab shows a **preview** of that bracket:
`lib/tournament-data.ts → loadFinalsPreview` feeds `generateFinalBracket`
qualifier slots with no participant, so every slot reads "A1", "B2" … . The
groups are ordered by their leaders' current standings, so the preview tracks
the live table. It writes nothing — only `generateFinals` persists a bracket.
