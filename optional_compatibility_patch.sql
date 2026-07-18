-- Orchard Collection v2.1 compatibility check
-- Run only if photo uploads later report that plant_id is missing from the photos table.

alter table public.photos
add column if not exists plant_id uuid references public.plants(id);

-- Existing activity_log.plant_id is intentionally retained and the app now supplies it.
