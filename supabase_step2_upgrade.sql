
-- Orchard Collection Phase 1, Step 2
-- Adds cloud-synced favorites and a few optional metadata fields.

alter table public.plants
  add column if not exists favorite boolean not null default false,
  add column if not exists genus text,
  add column if not exists acquired_date date,
  add column if not exists purchase_price numeric,
  add column if not exists current_value numeric;

create index if not exists plants_favorite_idx
  on public.plants (owner_id, favorite)
  where favorite = true;
