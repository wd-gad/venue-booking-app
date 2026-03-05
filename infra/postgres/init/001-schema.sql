create extension if not exists pgcrypto;

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  name text not null,
  address text not null,
  event_date date not null,
  fee integer not null,
  status varchar(24) not null,
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

create index if not exists venues_event_date_idx on venues (event_date);
create index if not exists venues_status_idx on venues (status);

create table if not exists venue_documents (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues(id) on delete cascade,
  storage_key text not null,
  file_name text not null,
  content_type text not null,
  uploaded_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists venue_documents_venue_id_idx on venue_documents (venue_id);
