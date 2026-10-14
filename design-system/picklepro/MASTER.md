# PicklePro — Design System (Master)

Direction: **Sporty court** — energetic but clean. Chosen 2026-10-15.
Source: ui-ux-pro-max (`Vibrant & Block-based` style, Barlow Condensed type);
its suggested team-red palette was replaced with the existing pickleball green.

## Color tokens (`src/app/globals.css`)
| Token | Role |
|---|---|
| `primary` | Court green. Every primary action, links, "W" results. White text ≥ 4.5:1 in light mode. |
| `ball` / `ball-foreground` | Lime pickleball. Highlight only: live matches, champions, active pill ring. Never body text on white. |
| `court` / `court-foreground` | Deep green surface: active tab, active category pill, hero/score bars. |
| `chart-2/3/4` | Stage colors: group stage (blue), final stage (orange), runner-up (amber). |
| `destructive`, `warning`, `success` | Semantic states. |

Never use raw hex or Tailwind palette colors (`yellow-400`, etc.) in components.

## Typography
- `font-heading` = **Barlow Condensed** (500–800): h1/h2 (applied globally), card titles, tab labels, scores.
- `font-sans` = **Geist**: body, forms, tables.
- `.scoreboard` — condensed tabular numerals for scores, seeds, standings.
- `.eyebrow` — small uppercase label ("GROUP A", "SET 1").

## Surfaces
- Solid cards: `bg-card` + `border` + `shadow-card`, `rounded-2xl`. No backdrop blur (`.glass` is now a solid card).
- Raised (dialogs, popovers, status pill): `.glass-strong` / `shadow-raised`.
- Page background: flat with a faint green wash at the top (`.bg-app-gradient`).

## Interaction
- Touch targets ≥ 44px on phones: buttons `h-11` → `sm:h-9`, inputs `h-11` → `sm:h-9`, pills `min-h-11`.
- Press feedback: `scale-[0.97]`; transitions 150ms on color/transform only.
- `prefers-reduced-motion` disables animation globally.
- Loading: a non-blocking top bar + status pill (`LoadingOverlay`), with a `PageSkeleton` underneath. Never a full-screen veil.

## Saving
- Server actions revalidate the page they affect; the client must **not** also call `router.refresh()` (a second round trip).
- Auth is resolved once per request (`lib/auth.ts → getUser`, `actions/helpers.ts → getSessionUser`, both memoized).
- Audit logs are written in `after()`, off the critical path.
- Prefer optimistic UI (`useOptimistic` / local state first, reconcile on error) for toggles and inline edits.
