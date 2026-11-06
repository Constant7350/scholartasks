-- Audit fixes (November 2026).
-- 1. Homework Helper add-on turns now refuse students under 13, like every
--    other AI feature (migration 0043 covered ai_take_turn only).
-- 2. Email opt-outs: anyone can stop school invite emails with one click
--    (CAN-SPAM). The roster invite list skips opted-out addresses.

create or replace function homework_take_turn(p_student uuid, p_addon boolean, p_daily int, p_monthly int) returns boolean
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'America/New_York')::date;
        used int; month_used int; fid uuid;
begin
  if not exists (select 1 from user_settings where user_id = auth.uid() and ai_consent_at is not null) then
    raise exception 'ai consent needed';
  end if;
  if p_student is not null and is_under_13(p_student) then raise exception 'not allowed: under 13'; end if;
  if p_student is null or not may_chat_about(p_student) then raise exception 'not allowed'; end if;
  if is_student_self(p_student) and not homework_enabled(p_student) then raise exception 'helper turned off'; end if;
  if not p_addon then return ai_take_turn(p_student, p_daily); end if;

  fid := (select family_id from students where id = p_student);
  insert into homework_usage (student_id, day, turns) values (p_student, today, 1)
    on conflict (student_id, day) do update set turns = homework_usage.turns + 1
    returning turns into used;
  select coalesce(sum(u.turns), 0) into month_used
    from homework_usage u join students s on s.id = u.student_id
   where s.family_id = fid and u.day >= date_trunc('month', today)::date;
  if used > p_daily or month_used > p_monthly then
    update homework_usage set turns = turns - 1 where student_id = p_student and day = today;
    update ai_credits set balance = balance - 1, updated_at = now()
      where family_id = fid and balance > 0;
    return found;
  end if;
  return true;
end $$;
revoke all on function homework_take_turn(uuid, boolean, int, int) from public;
grant execute on function homework_take_turn(uuid, boolean, int, int) to authenticated;

create table if not exists email_opt_outs (
  email text primary key check (email = lower(email)),
  kind text not null default 'school_invites',
  created_at timestamptz not null default now()
);
alter table email_opt_outs enable row level security;
revoke all on email_opt_outs from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, delete on email_opt_outs to service_role';
  end if;
end $$;

create or replace function school_roster_invitees(p_school uuid, p_user uuid, p_grades int[])
returns table (email text)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from school_staff where school_id = p_school and user_id = p_user) then raise exception 'not allowed'; end if;
  if not exists (select 1 from schools where id = p_school and status = 'approved') then raise exception 'not allowed'; end if;
  return query
    with picked as (
      select s.student_ref, s.email from school_roster_status_for(p_school) s
       where not s.connected and s.email is not null
         and not exists (select 1 from email_opt_outs o where o.email = lower(s.email))
         and (coalesce(array_length(p_grades, 1), 0) = 0 or s.grade_level = any(p_grades))
         and (s.invited_at is null or s.invited_at < now() - interval '7 days')
    ), marked as (
      update school_roster r set invited_at = now() from picked p
       where r.school_id = p_school and r.student_ref = p.student_ref returning r.email
    )
    select distinct m.email from marked m;
  insert into audit_log (actor_id, action, target, target_id) values (p_user, 'invite', 'school_roster', p_school::text);
end $$;
revoke all on function school_roster_invitees(uuid, uuid, int[]) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function school_roster_invitees(uuid, uuid, int[]) to service_role';
  end if;
end $$;
