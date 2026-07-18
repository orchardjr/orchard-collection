
-- Orchard Collection v2 database upgrade
-- Run this entire file in Supabase SQL Editor before deploying the v2 frontend.

create extension if not exists pgcrypto;

alter table public.activity_log
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists owner_id uuid references auth.users(id),
  add column if not exists plant_accession text,
  add column if not exists activity_type text,
  add column if not exists notes text,
  add column if not exists occurred_at timestamptz default now(),
  add column if not exists created_at timestamptz default now();

alter table public.photos
  add column if not exists id uuid primary key default gen_random_uuid(),
  add column if not exists owner_id uuid references auth.users(id),
  add column if not exists plant_accession text,
  add column if not exists photo_url text,
  add column if not exists storage_path text,
  add column if not exists caption text,
  add column if not exists taken_at timestamptz default now(),
  add column if not exists created_at timestamptz default now();

create index if not exists activity_log_accession_idx
  on public.activity_log (plant_accession, occurred_at desc);

create index if not exists photos_accession_idx
  on public.photos (plant_accession, taken_at desc);

alter table public.activity_log enable row level security;
alter table public.photos enable row level security;

drop policy if exists "Users can view their activity" on public.activity_log;
drop policy if exists "Users can create their activity" on public.activity_log;
drop policy if exists "Users can update their activity" on public.activity_log;
drop policy if exists "Users can delete their activity" on public.activity_log;

create policy "Users can view their activity"
on public.activity_log for select to authenticated
using (auth.uid() = owner_id);

create policy "Users can create their activity"
on public.activity_log for insert to authenticated
with check (auth.uid() = owner_id);

create policy "Users can update their activity"
on public.activity_log for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Users can delete their activity"
on public.activity_log for delete to authenticated
using (auth.uid() = owner_id);

drop policy if exists "Users can view their photos" on public.photos;
drop policy if exists "Users can create their photos" on public.photos;
drop policy if exists "Users can update their photos" on public.photos;
drop policy if exists "Users can delete their photos" on public.photos;

create policy "Users can view their photos"
on public.photos for select to authenticated
using (auth.uid() = owner_id);

create policy "Users can create their photos"
on public.photos for insert to authenticated
with check (auth.uid() = owner_id);

create policy "Users can update their photos"
on public.photos for update to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

create policy "Users can delete their photos"
on public.photos for delete to authenticated
using (auth.uid() = owner_id);

insert into storage.buckets (id, name, public)
values ('plant-photos', 'plant-photos', true)
on conflict (id) do update set public = true;

drop policy if exists "Users upload their plant photos" on storage.objects;
drop policy if exists "Users update their plant photos" on storage.objects;
drop policy if exists "Users delete their plant photos" on storage.objects;
drop policy if exists "Public can view plant photos" on storage.objects;

create policy "Users upload their plant photos"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'plant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users update their plant photos"
on storage.objects for update to authenticated
using (
  bucket_id = 'plant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'plant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users delete their plant photos"
on storage.objects for delete to authenticated
using (
  bucket_id = 'plant-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Public can view plant photos"
on storage.objects for select to public
using (bucket_id = 'plant-photos');
