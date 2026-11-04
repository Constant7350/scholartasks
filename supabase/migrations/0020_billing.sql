-- Paid plans (Stripe). The parent who owns the family pays. Stripe tells the
-- server what was bought through a signed webhook, and only the server (with
-- the secret key) writes these tables. Families can read their own rows.
--
-- What a family can have:
--   * the family plan (monthly or yearly subscription)
--   * the Study Coach add-on (its own subscription)
--   * AI message packs (one-time purchases that add to a shared balance,
--     used only after the day's free AI uses run out)

create table if not exists billing_customers (
  family_id          uuid primary key references families(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at         timestamptz not null default now()
);

create table if not exists billing_subscriptions (
  id                    text primary key,            -- Stripe subscription id (sub_...)
  family_id             uuid not null references families(id) on delete cascade,
  kind                  text not null check (kind in ('family', 'study_coach')),
  status                text not null,               -- Stripe status: active, trialing, past_due, canceled, ...
  billing_interval      text check (billing_interval in ('month', 'year')),
  current_period_end    timestamptz,
  cancel_at_period_end  boolean not null default false,
  updated_at            timestamptz not null default now()
);
create index if not exists billing_subscriptions_family on billing_subscriptions (family_id);

create table if not exists ai_credits (
  family_id  uuid primary key references families(id) on delete cascade,
  balance    int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- One row per paid pack, keyed by the Stripe Checkout session, so a webhook
-- that arrives twice can never add the same pack twice.
create table if not exists ai_credit_grants (
  id         text primary key,                       -- Stripe Checkout session id (cs_...)
  family_id  uuid not null references families(id) on delete cascade,
  credits    int not null check (credits > 0),
  created_at timestamptz not null default now()
);

-- Webhook events already handled (Stripe can resend an event).
create table if not exists billing_events (
  id          text primary key,                      -- Stripe event id (evt_...)
  type        text not null,
  received_at timestamptz not null default now()
);

alter table billing_customers     enable row level security;
alter table billing_subscriptions enable row level security;
alter table ai_credits            enable row level security;
alter table ai_credit_grants      enable row level security;
alter table billing_events        enable row level security;

drop policy if exists billing_customers_parent_read on billing_customers;
create policy billing_customers_parent_read on billing_customers for select using (is_parent_of_family(family_id));
drop policy if exists billing_subscriptions_parent_read on billing_subscriptions;
create policy billing_subscriptions_parent_read on billing_subscriptions for select using (is_parent_of_family(family_id));
drop policy if exists ai_credits_parent_read on ai_credits;
create policy ai_credits_parent_read on ai_credits for select using (is_parent_of_family(family_id));
drop policy if exists ai_credit_grants_parent_read on ai_credit_grants;
create policy ai_credit_grants_parent_read on ai_credit_grants for select using (is_parent_of_family(family_id));
grant select on billing_customers, billing_subscriptions, ai_credits, ai_credit_grants to authenticated;
grant select, insert, update, delete on billing_customers, billing_subscriptions, ai_credits, ai_credit_grants, billing_events to service_role;

drop trigger if exists billing_subscriptions_audit on billing_subscriptions;
create trigger billing_subscriptions_audit after insert or update or delete on billing_subscriptions
  for each row execute function audit_row_change();
drop trigger if exists ai_credit_grants_audit on ai_credit_grants;
create trigger ai_credit_grants_audit after insert or update or delete on ai_credit_grants
  for each row execute function audit_row_change();

-- The family whose AI balance a turn uses: the student's family, or with no
-- student chosen, the caller's own family (parents first).
create or replace function ai_family_for(p_student uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select case when p_student is not null
    then (select family_id from students where id = p_student)
    else (select m.family_id from family_members m where m.user_id = auth.uid()
           order by (m.role = 'parent') desc, m.family_id limit 1)
  end;
$$;

-- A subscription counts while Stripe says active or trialing, plus a short
-- grace while a card is being retried (past_due).
create or replace function family_has(p_family uuid, p_kind text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from billing_subscriptions s
                  where s.family_id = p_family and s.kind = p_kind
                    and s.status in ('active', 'trialing', 'past_due'));
$$;

-- What the signed-in person's family has, for the app to show and unlock
-- features. Anyone in the family (parent or student) may ask.
create or replace function my_plan(p_student uuid default null)
returns table (family_id uuid, family_plan boolean, study_coach boolean, ai_credits int)
language plpgsql stable security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  if p_student is not null and not (can_parent_see_student(p_student) or is_student_self(p_student)) then
    raise exception 'not allowed';
  end if;
  fid := ai_family_for(p_student);
  return query select fid, family_has(fid, 'family'), family_has(fid, 'study_coach'),
    coalesce((select c.balance from ai_credits c where c.family_id = fid), 0);
end $$;
revoke all on function my_plan(uuid) from public;
grant execute on function my_plan(uuid) to authenticated;

-- Same as before, except that once the day's free uses run out, a turn is
-- taken from the family's paid message packs (if any are left).
create or replace function ai_take_turn(p_student uuid, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare used int; fid uuid;
begin
  if not may_chat_about(p_student) then raise exception 'not allowed'; end if;
  insert into ai_usage (user_id, day, messages)
    values (auth.uid(), (now() at time zone 'America/New_York')::date, 1)
    on conflict (user_id, day) do update set messages = ai_usage.messages + 1
    returning messages into used;
  if used > p_limit then
    update ai_usage set messages = messages - 1
      where user_id = auth.uid() and day = (now() at time zone 'America/New_York')::date;
    fid := ai_family_for(p_student);
    if fid is null then return false; end if;
    update ai_credits set balance = balance - 1, updated_at = now()
      where family_id = fid and balance > 0;
    return found;
  end if;
  return true;
end $$;

-- Server only: adds a paid pack once per Checkout session. Returns false if
-- this session was already counted.
create or replace function billing_grant_credits(p_session text, p_family uuid, p_credits int) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into ai_credit_grants (id, family_id, credits) values (p_session, p_family, p_credits)
    on conflict (id) do nothing;
  if not found then return false; end if;
  insert into ai_credits (family_id, balance) values (p_family, p_credits)
    on conflict (family_id) do update set balance = ai_credits.balance + excluded.balance, updated_at = now();
  return true;
end $$;
revoke all on function billing_grant_credits(text, uuid, int) from public;
grant execute on function billing_grant_credits(text, uuid, int) to service_role;
