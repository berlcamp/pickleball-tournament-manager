# 🏓 PicklePro by Sortbrite — Pickleball Tournament Manager

A production-ready pickleball tournament SaaS inspired by Challonge. Run
tournaments with collaborator roles, round-robin groups, finals brackets, a
smart court-scheduling engine, public shareable pages with online registration,
and QR-code sharing.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**,
**shadcn/ui**, and **Supabase** (Postgres + Auth + Realtime + RLS).

---

## Features

- **Google OAuth** authentication with profile management
- **Collaboration roles** — Owner, Admin, Scorekeeper, Viewer (invite by Google email)
- **Teams** — add individually or bulk-import (one team per line)
- **Seeding** — drag-and-drop manual seeding + animated 3-second random shuffle
- **Groups** — choose the number of groups, snake-seeded auto-assignment
- **Group stage** — round-robin generation, score entry, automatic standings with tie-breakers
- **Finals** — auto-generated **Crossover** or **Standard Seed** knockout brackets
- **Championship** — auto-determines Champion, 1st/2nd Runner-Up, and 3rd Place
- **Smart scheduling engine** — courts, intervals, rest periods, conflict detection, sequential or equally-distributed modes
- **Public portal** (no login) — standings, schedule, and per-team pages
- **Live standings** — Supabase Realtime, no refresh required
- **Online registration** — teams sign up from the public link and upload proof of payment
- **QR sharing** for standings, schedule, and results
- Dark mode, glassmorphism UI, animated progress & brackets, responsive design

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

Create a project at [supabase.com](https://supabase.com), then open the **SQL
Editor** and run the migration:

```
supabase/migrations/0001_init.sql
```

This creates a dedicated **`pickleball`** schema containing all tables, enums,
RLS policies, triggers (auto profile + owner membership + invite auto-accept),
grants, and Realtime.

> **Required:** expose the schema to the API. Go to **Project Settings → API →
> "Exposed schemas"** and add `pickleball` (keep `public` and `graphql_public`).
> Without this, PostgREST/the JS client can't read the schema. The app's
> Supabase clients are already configured with `db: { schema: "pickleball" }`.

### 3. Configure Google OAuth

In the Supabase dashboard → **Authentication → Providers → Google**, enable
Google and add your OAuth client credentials. Add this redirect URL:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

And in **Authentication → URL Configuration**, set the Site URL to
`http://localhost:3000` (and your production URL).

### 4. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # optional, see note below
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> The service-role key is **optional**. Public pages read through the anon key
> using the public RLS `select` policies. The service-role key is only used as a
> fallback/admin path and must never be exposed to the browser.

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Typical workflow

1. **Create a tournament** → `/dashboard/tournaments/new`
2. **Add teams** (Teams tab) — individually or bulk import
3. **Seed** teams (drag-and-drop or random shuffle)
4. **Generate groups** — pick the count; snake seeding distributes teams
5. **Group stage** — enter scores; standings update live with tie-breakers
6. **Schedule** — set courts/times and generate the court schedule
7. **Finals** — once all group matches are done, generate the bracket
8. **Results** — Champion + podium auto-computed; share via QR / public links

Public, no-login pages:

- `/tournament/[slug]/standings`
- `/tournament/[slug]/schedule`
- `/tournament/[slug]/teams/[id]`

---

## Project structure

```
src/
  actions/      Server actions (tournaments, participants, seeding, groups,
                group stage, finals, schedule, members)
  app/          App Router pages (dashboard, public portal, auth)
  components/   UI + feature components (shadcn/ui in components/ui)
  lib/          Supabase clients, auth, data loaders, formatting, constants
  services/     Pure tournament engine (seeding, round robin, standings,
                brackets, scheduler) — framework-free & unit-testable
  types/        Domain + Supabase Database types
  validators/   Zod schemas
supabase/
  migrations/   SQL schema + RLS + triggers
```

The **tournament engine** in `src/services/` is intentionally pure (no I/O), so
the seeding, round-robin, standings, bracket, and scheduling algorithms can be
reasoned about and tested in isolation.

---

## Standings & tie-breakers

Standings track Match W-L-T, TB, Set Wins, Set Ties, total Points, and a W/L/T
match-history strip. Ties are broken in this order:

1. Most match wins
2. Head-to-head result (two-team ties)
3. Total points
4. Point differential
5. Random draw (configurable fallback)

---

## Tech notes

- Auth/session handled by `@supabase/ssr` with a proxy (`src/proxy.ts`) session refresh.
- Row Level Security restricts writes by role; public read policies power the
  no-login portal.
- Realtime is enabled on `standings`, `group_matches`, `final_matches`, and
  `match_schedules`; public pages auto-refresh on change.

## Scripts

```bash
npm run dev      # start dev server
npm run build    # production build
npm run start    # run the production build
npm run lint     # eslint
```
