-- Weekly progress email for parents (Constant, 2026-11-06).
--
-- Once a week, each parent whose student used the Homework Helper in the last four weeks
-- gets a short email built from the same numbers they see on the Homework Helper page:
-- problems finished, hints per problem, subjects, and times the helper said no. An AI
-- (claude-haiku-5-5) writes it: real praise when the numbers show progress, and when they
-- don't, one different tactic for the parent to try this week. The full chats are still
-- never stored, and the email never quotes them.
--
--   * user_settings.progress_emails   on unless the parent turns it off (Homework Helper page
--                                      or the one-click link in every email)
--   * progress_email_log              one row per parent, student and week: stops double
--                                      sends and lets next week's email follow up on the
--                                      tactic suggested last week

alter table user_settings add column if not exists progress_emails boolean not null default true;

create table if not exists progress_email_log (
  user_id    uuid not null,
  student_id uuid not null references students(id) on delete cascade,
  week_start date not null,
  trend      text not null check (trend in ('better', 'steady', 'slipping', 'quiet', 'new')),
  tactic     text check (char_length(tactic) <= 400),
  sent_at    timestamptz not null default now(),
  primary key (user_id, student_id, week_start)
);
alter table progress_email_log enable row level security;
drop policy if exists progress_email_log_read on progress_email_log;
create policy progress_email_log_read on progress_email_log for select using (user_id = auth.uid());
grant select on progress_email_log to authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant select, insert, update, delete on progress_email_log to service_role';
  end if;
end $$;

-- Who gets this week's email: every parent of a student who used the helper in the four
-- weeks before p_week_end, unless the parent turned the email off, the helper is off for that
-- student, or an 18+ student said no to parent access. One row per parent and student.
create or replace function progress_email_due(p_week_start date)
returns table (user_id uuid, email text, student_id uuid, first_name text, grade_level int, lang text, last_tactic text, last_trend text)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, s.id, s.first_name, s.grade_level, coalesce(us.lang, 'en'),
         prev.tactic, prev.trend
    from students s
    join family_members m on m.family_id = s.family_id and m.role = 'parent'
    join auth.users u on u.id = m.user_id
    left join user_settings us on us.user_id = m.user_id
    left join lateral (
      select l.tactic, l.trend from progress_email_log l
       where l.user_id = m.user_id and l.student_id = s.id and l.week_start < p_week_start
       order by l.week_start desc limit 1
    ) prev on true
   where coalesce(s.adult_consents_parent_access, true)
     and coalesce(us.progress_emails, true)
     and homework_enabled(s.id)
     and u.email is not null
     and exists (select 1 from homework_log h where h.student_id = s.id
                  and h.created_at >= (p_week_start - 21)::timestamptz
                  and h.created_at <  (p_week_start + 7)::timestamptz)
     and not exists (select 1 from progress_email_log l where l.user_id = m.user_id and l.student_id = s.id and l.week_start = p_week_start);
$$;

-- The one-click link in the email turns it off for that address without signing in.
create or replace function progress_emails_off(p_email text) returns void
language sql security definer set search_path = public as $$
  insert into user_settings (user_id, progress_emails)
    select u.id, false from auth.users u where lower(u.email) = lower(trim(p_email))
  on conflict (user_id) do update set progress_emails = false, updated_at = now();
$$;

revoke all on function progress_email_due(date) from public, anon, authenticated;
revoke all on function progress_emails_off(text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function progress_email_due(date) to service_role';
    execute 'grant execute on function progress_emails_off(text) to service_role';
  end if;
end $$;
