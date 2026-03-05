create extension if not exists pgcrypto;

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  address text not null,
  event_date date not null,
  fee integer not null check (fee >= 0),
  status text not null check (status in ('booked', 'candidate')),
  lat double precision not null,
  lng double precision not null,
  contact_tel text not null default '',
  contact_fax text not null default '',
  contact_email text not null default '',
  permit_file_path text,
  permit_file_name text,
  conversation_notes jsonb not null default '[]'::jsonb,
  editor_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.venues enable row level security;

drop policy if exists "Authenticated users can view all venues" on public.venues;
drop policy if exists "Users can insert their own venues" on public.venues;
drop policy if exists "Users can update their own venues" on public.venues;
drop policy if exists "Users can delete their own venues" on public.venues;
drop policy if exists "Users can view their own venues" on public.venues;

create policy "Authenticated users can view all venues"
on public.venues
for select
using (
  auth.role() = 'authenticated'
);

create policy "Users can insert their own venues"
on public.venues
for insert
with check (
  auth.uid() = user_id
);

create policy "Users can update their own venues"
on public.venues
for update
using (
  auth.uid() = user_id
)
with check (
  auth.uid() = user_id
);

create policy "Users can delete their own venues"
on public.venues
for delete
using (
  auth.uid() = user_id
);

insert into storage.buckets (id, name, public)
values ('venue-documents', 'venue-documents', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can view venue documents" on storage.objects;
drop policy if exists "Authenticated users can upload venue documents" on storage.objects;
drop policy if exists "Authenticated users can update venue documents" on storage.objects;
drop policy if exists "Authenticated users can delete venue documents" on storage.objects;

create policy "Authenticated users can view venue documents"
on storage.objects
for select
using (bucket_id = 'venue-documents');

create policy "Authenticated users can upload venue documents"
on storage.objects
for insert
with check (
  bucket_id = 'venue-documents'
  and auth.role() = 'authenticated'
);

create policy "Authenticated users can update venue documents"
on storage.objects
for update
using (
  bucket_id = 'venue-documents'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'venue-documents'
  and auth.role() = 'authenticated'
);

create policy "Authenticated users can delete venue documents"
on storage.objects
for delete
using (
  bucket_id = 'venue-documents'
  and auth.role() = 'authenticated'
);
