-- Monthly AI check of the trades facts (aid programs and Georgia license
-- rules in packs/trades/trades.json) against official sites. The checker
-- (Vercel Cron, /api/cron/trades) saves one row per fact; anything that
-- looks changed waits on /admin/trades for a team member. The trades list
-- itself is data in the app, so a person fixes it there and marks the row
-- fixed. Families never see this table. Safe to run twice.

create table if not exists trade_checks (
  subject      text primary key check (subject ~ '^[a-z]+:[a-z0-9-]+$'),
  title        text not null check (length(title) <= 200),
  url          text not null check (url ~ '^https://'),
  checked_on   date,
  result       text not null default 'ok' check (result in ('ok', 'changed', 'unclear')),
  summary      text check (length(summary) <= 2000),
  sources      text[] not null default '{}',
  status       text not null default 'ok' check (status in ('ok', 'review', 'fixed', 'dismissed')),
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  updated_at   timestamptz not null default now()
);
create index if not exists trade_checks_due on trade_checks (checked_on nulls first);
alter table trade_checks enable row level security;
drop policy if exists trade_checks_admin on trade_checks;
create policy trade_checks_admin on trade_checks for all to authenticated using (is_app_admin()) with check (is_app_admin());
grant select, insert, update, delete on trade_checks to authenticated;
