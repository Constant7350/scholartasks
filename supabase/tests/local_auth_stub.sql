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
