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

Copy `.env.example` → `.env.local`. `SUPABASE_SERVICE_ROLE_KEY` is optional
(see service-role note below). Critical, non-obvious setup step: in Supabase
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
seeding, groups, groupStage, finals, schedule, members). Shared conventions live
in `actions/helpers.ts` and must be followed:
- Wrap action bodies in `run()` → returns `ActionResult<T>` (`{ ok, data } | { ok: false, error }`); throw `ActionError` for user-facing failures.
- Authorize **every mutation** with `assertRole(tournamentId, minRole)`. Roles rank `viewer < scorekeeper < admin < owner` (`lib/constants.ts → roleAtLeast`). RLS is a backstop, not the primary check.
- Call `logAudit(...)` for significant actions (best-effort; never throws).
- Validate input with Zod schemas from `src/validators/` before touching the DB.
- `revalidatePath(...)` after writes that affect cached pages.

### The tournament engine (`src/services/`)
Pure, framework-free, I/O-free modules — keep them that way (no Supabase imports):
- `seeding.ts` — manual + snake/random seeding
- `roundRobin.ts` — group match generation
- `standings.ts` — standings computation + tie-breaker chain (match wins → head-to-head → points → point differential → random)
- `brackets.ts` — finals brackets (`crossover` vs `standard_seed`), qualifier/round labeling
- `scheduler.ts` — court scheduling (intervals, rest periods, conflict detection; `sequential` vs equally-distributed modes)

Actions/data loaders pull rows from Supabase, hand plain objects to these
functions, and persist the results. Loaders that assemble view models for
pages live in `src/lib/tournament-data.ts` and take a `SupabaseClient` so they
work with either the authed or public client.

### Routing
- `src/app/dashboard/**` — authed management UI; tournament workspace is `tournaments/[id]/{participants,seeding,groups,group-stage,schedule,finals,results,settings}`.
- `src/app/tournament/[slug]/**` — public, no-login portal (standings, schedule, per-team).
- `src/app/monitor` — live TV board (`/monitor?t=[slug]`).

### Realtime
Enabled on `standings`, `group_matches`, `final_matches`, `match_schedules`.
Public/live pages subscribe via the browser client (see `components/public/live-refresh.tsx`) and refresh on change — no polling.

### Types
- `src/types/database.ts` — Supabase `Database` type for the `pickleball` schema.
- `src/types/index.ts` — domain types (`Role`, `Tournament`, statuses, etc.).

## Conventions
- Import alias: `@/*` → `src/*`.
- UI: shadcn/ui primitives in `src/components/ui/` (configured via `components.json`); feature components in `components/tournament/`, `components/dashboard/`, `components/public/`. Tailwind v4 (no `tailwind.config`; config is in `globals.css` / `postcss.config.mjs`).
- Tournament status flow: `draft → group_stage → final_stage → completed` (`STATUS_FLOW` in `lib/constants.ts`).
