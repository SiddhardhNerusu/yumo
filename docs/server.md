# Server (§8) — API backbone

**Status: BUILT & verified** (boots as a real process; 14 supertest API tests).
`@usual/server` — Node/Express, in the monorepo so it imports the engines
directly. Run it: `npm run server:dev` (defaults to `:8080`).

## What it exposes (§8.1)

| Method + path | Auth | Notes |
|---|---|---|
| `GET /api/health` | — | status + build string (Render deploy-verify, Goyo pattern) |
| `GET /api/config` | — | remote config: Brain weights/caps + menu tunables |
| `POST /api/auth/apple` · `/google` | — | ⚠️ token verification **stubbed** (refused in prod until JWKS verify is implemented) |
| `POST /api/auth/dev` | — | dev-only login for tests/local; 404 in prod |
| `GET/PATCH /api/profile` | JWT | budget, allergies, hates, needs, likes, pantry, variation, cuisine lean |
| `GET /api/onboarding/bubbles` | — | data-driven from catalogue ingredient frequency (§2.2) |
| `GET /api/foods/search` | — | ranked FDC search |
| `GET /api/foods/barcode/:ean` | — | 501 stub (OpenFoodFacts pending) |
| `GET /api/recipes/:id` | — | recipe detail + steps |
| `POST /api/menu/generate` | JWT | wires `@usual/menu`; **entitlement-gated** (free = 3-day/1 need, premium = 7-day/all needs) |
| `GET /api/menu/current` | JWT | last generated menu |
| `POST /api/menu/mixup` | JWT | wires `mixItUp` |
| `POST/GET /api/sync/events` | JWT | opaque encrypted blob per batch; **server never parses** (§8.2) |

Auth is a signed JWT session (`Authorization: Bearer`); `requirePremium` returns 402.

## Data layer

- **`Store` interface + `MemoryStore`** — runs and tests today, seeded from the
  real catalogue (FDC store + pipeline over the recipe drafts).
- **`server/migrations/001_init.sql`** — the full Postgres schema (§4.1 food
  graph, §4.2 recipes/ingredients, users/entitlements/profiles/menus,
  event_batches as `bytea`, template_packs, remote_config).
- **`createStore()`** uses memory unless `DATABASE_URL` is set; a set URL fails
  loudly (the pg adapter is the documented next step — no silent memory in prod).

## Verified

- 14 supertest cases: health/config, dev auth + 401 on missing token, profile
  persist, bubbles, food search, barcode 501, recipe 404, free 3-day vs premium
  7-day menu with need-pinning, mix-it-up, event sync round-trip.
- Boots as a real process; smoke-tested over HTTP (health, config, bubbles,
  food search, auth→profile→generate → 3-day menu at 2,209 kcal).

## Explicit next steps (not done here — need external services / your OK)

- **Postgres/Supabase**: implement the `pg` adapter against `001_init.sql` +
  provision a project (one-OK step). A catalogue-publish job replaces the
  in-memory seed.
- **Apple/Google token verification** against provider JWKS (security-critical;
  stubbed now).
- **RevenueCat** webhook → `user_entitlements` (§8.3).
- Sunday per-tz menu regeneration job; coach template packs (§7.3).
