-- Mirror Supabase: pgcrypto lives in the extensions schema.
create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
-- Local-only stand-in for Supabase's auth schema so migrations can be tested
-- on plain PostgreSQL. Never run this against Supabase.
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
end $$;
grant usage on schema auth to anon, authenticated;
-- Minimal auth.users and service_role so reminder functions can be created and tested.
create table if not exists auth.users (id uuid primary key, email text);
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
grant usage on schema auth to service_role;
-- Minimal stand-in for Supabase Storage so bucket and file policies can be tested.
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text not null, owner uuid default auth.uid(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
