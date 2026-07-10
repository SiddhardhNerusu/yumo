-- Usual server — initial schema (§8.2). Postgres.
-- Server-authoritative: users, entitlements, food graph, recipes, menus, config.
-- Client-authoritative (synced, opaque): event batches.

create table if not exists users (
  id          text primary key,
  email       text,
  provider    text not null check (provider in ('apple','google','dev')),
  provider_id text not null,
  created_at  timestamptz not null default now(),
  unique (provider, provider_id)
);

create table if not exists user_entitlements (
  user_id    text primary key references users(id) on delete cascade,
  tier       text not null default 'free' check (tier in ('free','premium')),
  source     text,                       -- 'revenuecat' etc.
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id         text primary key references users(id) on delete cascade,
  budget_kcal     integer not null,
  target_weight_kg real not null,
  goal            text not null check (goal in ('lose','maintain','gain')),
  allergies       jsonb not null default '[]',
  hates           jsonb not null default '[]',
  needs           jsonb not null default '[]',
  likes           jsonb not null default '[]',
  pantry          jsonb not null default '[]',
  variation       text not null default 'balanced' check (variation in ('habit','balanced','mixup')),
  cuisine_lean    jsonb not null default '{}',
  updated_at      timestamptz not null default now()
);

-- Food graph (§4.1). USDA FDC-derived nutrients; CC0, storable.
create table if not exists foods (
  id               text primary key,
  fdc_id           integer,
  canonical_name   text not null,
  kcal_per_100g    real not null,
  protein          real not null default 0,
  carbs            real not null default 0,
  fat              real not null default 0,
  default_portion_g real,
  portion_label    text,
  allergens        jsonb not null default '[]',
  tags             jsonb not null default '[]'
);

create table if not exists food_edges (
  from_id text not null references foods(id) on delete cascade,
  to_id   text not null references foods(id) on delete cascade,
  weight  real not null default 1,
  primary key (from_id, to_id)
);

-- Recipes (§4.2). Macros are COMPUTED (never authored) and stored with the
-- recipe; recipe_ingredients keeps full FDC traceability.
create table if not exists recipes (
  id            text primary key,
  name          text not null,
  cuisine       text,
  slot_affinity jsonb not null default '[]',
  effort        text check (effort in ('5min','15min','30min+')),
  method_tags   jsonb not null default '[]',
  steps         jsonb not null default '[]',   -- array of <=6 strings
  kcal          real not null,
  protein       real not null,
  carbs         real not null,
  fat           real not null,
  allergens     jsonb not null default '[]',
  status        text not null default 'draft' check (status in ('draft','reviewed','live','retired','needs_review')),
  version       integer not null default 1,
  review_meta   jsonb not null default '{}'
);

create table if not exists recipe_ingredients (
  recipe_id text not null references recipes(id) on delete cascade,
  idx       integer not null,
  food_id   text,
  fdc_id    integer,
  qty_g     real not null,
  qty_label text,
  note      text,
  primary key (recipe_id, idx)
);

create table if not exists menus (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  week_start date not null,
  seed       text not null,
  plan       jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists menus_user_idx on menus (user_id, created_at desc);

-- Synced event log (§3.2 / §8.2). Encrypted blob per batch; server does not
-- parse contents in v1.
create table if not exists event_batches (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  received_at timestamptz not null default now(),
  blob        bytea not null,
  count       integer not null default 0
);
create index if not exists event_batches_user_idx on event_batches (user_id, received_at);

-- Versioned coach copy packs (§7.3) and remote config (§8.1).
create table if not exists template_packs (
  id         text primary key,
  version    integer not null default 1,
  locale     text not null default 'en',
  kind       text not null,
  data       jsonb not null
);

create table if not exists remote_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);
