-- Text message reminders: opt-in, one verified U.S. phone number per person,
-- texts only 7 days, 1 day and the day of a deadline, and at most 20 texts a
-- month per person so the running cost stays small (about a penny a text).
-- Only the server writes these tables (it checks the code sent to the phone),
-- so nobody can switch texts on for a number they don't own.

create table if not exists sms_settings (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  phone          text check (phone is null or phone ~ '^\+1[2-9][0-9]{9}$'),
  sms_on         boolean not null default false,
  verified_at    timestamptz,
  pending_phone  text check (pending_phone is null or pending_phone ~ '^\+1[2-9][0-9]{9}$'),
  code_hash      text,
  code_expires   timestamptz,
  code_tries     int not null default 0,
  codes_sent_on  date,
  codes_sent     int not null default 0,
  updated_at     timestamptz not null default now()
);
alter table sms_settings enable row level security;
drop policy if exists sms_settings_self on sms_settings;
create policy sms_settings_self on sms_settings for select to authenticated using (user_id = auth.uid());
-- People may read their own row; only the server (service role) changes it.
grant select (user_id, phone, sms_on, verified_at, pending_phone, updated_at) on sms_settings to authenticated;

-- One row per text sent: stops repeats and counts the monthly cap.
create table if not exists sms_log (
  id          bigserial primary key,
  user_id     uuid not null,
  item_type   text not null check (item_type in ('task', 'college', 'batch')),
  item_id     uuid,
  days_before int,
  sent_at     timestamptz not null default now()
);
create index if not exists sms_log_user on sms_log (user_id, sent_at);
create unique index if not exists sms_log_once on sms_log (user_id, item_type, item_id, days_before) where item_type <> 'batch';
alter table sms_log enable row level security;  -- no policies: only the server job reads or writes it

-- What the daily job should text today: deadlines exactly 7, 1 or 0 days away,
-- for people with texts on and a verified number, not yet texted.
create or replace function sms_reminders_due(p_today date)
returns table (user_id uuid, phone text, student_first_name text, item_type text, item_id uuid, title text, due_on date, days_before int, texts_this_month int)
language sql stable security definer set search_path = public as $$
  with items as (
    select 'task'::text as item_type, t.id as item_id, t.student_id, t.title, t.due_on
      from tasks t where t.due_on is not null and t.status in ('todo','needs_parent_approval')
    union all
    select 'college', c.id, c.student_id, c.name || ' application', c.deadline
      from student_colleges c where c.deadline is not null and c.status in ('considering','applying') and c.approved
  ),
  due as (
    select i.*, (i.due_on - p_today) as days_before from items i where (i.due_on - p_today) in (7, 1, 0)
  ),
  recipients as (
    select d.*, m.user_id
      from due d join students s on s.id = d.student_id
      join family_members m on m.family_id = s.family_id
     where (m.role = 'parent' and coalesce(s.adult_consents_parent_access, true))
        or (m.role = 'student' and m.student_id = d.student_id)
  )
  select r.user_id, ss.phone, s.first_name, r.item_type, r.item_id, r.title, r.due_on, r.days_before,
         (select count(*)::int from sms_log l where l.user_id = r.user_id and l.item_type = 'batch'
            and l.sent_at >= date_trunc('month', p_today::timestamptz))
    from recipients r
    join sms_settings ss on ss.user_id = r.user_id and ss.sms_on and ss.verified_at is not null and ss.phone is not null
    join students s on s.id = r.student_id
   where not exists (select 1 from sms_log l where l.user_id = r.user_id and l.item_type = r.item_type
                                              and l.item_id = r.item_id and l.days_before = r.days_before);
$$;

revoke all on function sms_reminders_due(date) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function sms_reminders_due(date) to service_role';
    execute 'grant select, insert, update, delete on sms_settings, sms_log to service_role';
    execute 'grant usage on sequence sms_log_id_seq to service_role';
  end if;
end $$;
