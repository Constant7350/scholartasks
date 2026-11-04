-- Permission before AI help, and a way to report an AI answer.
--
-- Apple (5.1.2) requires asking a person before their details go to an outside
-- AI. Each person agrees once ("Allow AI help"); until then every AI feature
-- stops at ai_take_turn. They can turn it off again on the account page.
-- Google Play (AI-generated content) requires an in-app way to report an AI
-- answer: reports land in ai_reports and are emailed to support.

alter table user_settings add column if not exists ai_consent_at timestamptz;

create or replace function set_ai_consent(p_on boolean) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v timestamptz := case when p_on then now() end;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into user_settings (user_id, ai_consent_at) values (auth.uid(), v)
    on conflict (user_id) do update set ai_consent_at = v, updated_at = now();
  insert into audit_log (actor_id, action, target, target_id, details)
    values (auth.uid(), 'consent', 'ai_help', auth.uid()::text, jsonb_build_object('allowed', p_on));
  return v;
end $$;
revoke all on function set_ai_consent(boolean) from public, anon;
grant execute on function set_ai_consent(boolean) to authenticated;

-- Same as before (0020), plus the consent check first.
create or replace function ai_take_turn(p_student uuid, p_limit int) returns boolean
language plpgsql security definer set search_path = public as $$
declare used int; fid uuid;
begin
  if not exists (select 1 from user_settings where user_id = auth.uid() and ai_consent_at is not null) then
    raise exception 'ai consent needed';
  end if;
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

create table if not exists ai_reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  feature     text not null check (char_length(feature) <= 40),
  answer      text check (char_length(answer) <= 8000),
  note        text check (char_length(note) <= 2000),
  created_at  timestamptz not null default now(),
  check (coalesce(answer, note) is not null)
);
alter table ai_reports enable row level security;
drop policy if exists ai_reports_insert_own on ai_reports;
create policy ai_reports_insert_own on ai_reports for insert to authenticated with check (user_id = auth.uid());
drop policy if exists ai_reports_admin_read on ai_reports;
create policy ai_reports_admin_read on ai_reports for select using (exists (select 1 from app_admins a where a.user_id = auth.uid()));
grant insert on ai_reports to authenticated;
grant select on ai_reports to authenticated;

-- Account deletion (0022) also clears the person's reports.
create or replace function delete_account(p_user uuid)
returns uuid[] language plpgsql security definer set search_path = public as $$
declare
  m record;
  logins uuid[] := array[p_user];
begin
  if p_user is null then raise exception 'not signed in'; end if;

  for m in select family_id, role from family_members where user_id = p_user loop
    if m.role = 'parent' and not exists (
      select 1 from family_members where family_id = m.family_id and role = 'parent' and user_id <> p_user
    ) then
      if exists (
        select 1 from billing_subscriptions
        where family_id = m.family_id and status in ('active', 'trialing', 'past_due') and not cancel_at_period_end
      ) then
        raise exception 'Please cancel your paid plan first (Menu, Plan and billing), then delete the account.';
      end if;
      logins := logins || array(select user_id from family_members where family_id = m.family_id and role = 'student');
      insert into audit_log (actor_id, family_id, action, target, target_id, details)
      values (p_user, m.family_id, 'account_delete', 'families', m.family_id::text, '{}'::jsonb);
      delete from families where id = m.family_id;
    else
      delete from family_members where family_id = m.family_id and user_id = p_user;
    end if;
  end loop;

  logins := array(
    select distinct u from unnest(logins) u
    where u = p_user or not exists (select 1 from family_members where user_id = u)
  );

  delete from user_settings where user_id = any(logins);
  delete from reminder_log  where user_id = any(logins);
  delete from ai_usage      where user_id = any(logins);
  delete from ai_reports    where user_id = any(logins);
  delete from app_admins    where user_id = any(logins);

  insert into audit_log (actor_id, action, target, target_id, details)
  values (p_user, 'account_delete', 'auth.users', p_user::text, jsonb_build_object('sign_ins_removed', cardinality(logins)));
  return logins;
end $$;
revoke all on function delete_account(uuid) from public, anon, authenticated;
grant execute on function delete_account(uuid) to service_role;
