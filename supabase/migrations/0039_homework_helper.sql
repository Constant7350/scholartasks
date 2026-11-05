-- Homework Helper: an all-subject AI tutor that helps a student learn without
-- ever doing the work for them. This file adds what the database needs:
--
--   * homework_settings  a parent's on/off switch per student (on unless a parent turns it off)
--   * homework_usage     helper turns per student per day, for the add-on's fair-use limits
--   * homework_log       one short line per helper reply, so parents see what was practiced,
--                        how many hints it took, and when the helper said no. Full chats are
--                        never stored.
--
-- The add-on reuses the Study Coach subscription kind ('study_coach'), so billing
-- tables don't change.

create table if not exists homework_settings (
  student_id uuid primary key references students(id) on delete cascade,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists homework_usage (
  student_id uuid not null references students(id) on delete cascade,
  day        date not null,
  turns      int  not null default 0 check (turns >= 0),
  primary key (student_id, day)
);

create table if not exists homework_log (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  user_id    uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  subject    text not null check (char_length(subject) between 1 and 40),
  topic      text check (char_length(topic) <= 120),
  help_type  text not null check (help_type in ('question', 'hint', 'check', 'explain', 'writing_feedback', 'practice', 'redirect', 'other')),
  hints      int  not null default 0 check (hints between 0 and 20),
  solved     boolean not null default false,
  said_no    text check (said_no in ('answer', 'writing', 'test', 'other')),
  safety     boolean not null default false,
  note       text check (char_length(note) <= 300)
);
create index if not exists homework_log_student_time on homework_log (student_id, created_at desc);

alter table homework_settings enable row level security;
alter table homework_usage    enable row level security;
alter table homework_log      enable row level security;

-- Parents of the student and the student themselves can read; all writes go through the functions below.
drop policy if exists homework_settings_read on homework_settings;
create policy homework_settings_read on homework_settings for select
  using (can_parent_see_student(student_id) or is_student_self(student_id));
drop policy if exists homework_usage_read on homework_usage;
create policy homework_usage_read on homework_usage for select
  using (can_parent_see_student(student_id) or is_student_self(student_id));
drop policy if exists homework_log_read on homework_log;
create policy homework_log_read on homework_log for select
  using (can_parent_see_student(student_id) or is_student_self(student_id));
grant select on homework_settings, homework_usage, homework_log to authenticated;
grant select, insert, update, delete on homework_settings, homework_usage, homework_log to service_role;

-- Turning the helper off is a parent decision worth keeping a record of.
drop trigger if exists homework_settings_audit on homework_settings;
create trigger homework_settings_audit after insert or update or delete on homework_settings
  for each row execute function audit_row_change();

create or replace function homework_enabled(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select enabled from homework_settings where student_id = p_student), true);
$$;

-- A parent turns the helper on or off for one student.
create or replace function homework_set_enabled(p_student uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_parent_see_student(p_student) then raise exception 'not allowed'; end if;
  insert into homework_settings (student_id, enabled) values (p_student, p_on)
    on conflict (student_id) do update set enabled = excluded.enabled, updated_at = now();
end $$;

-- One helper turn. With the add-on (p_addon), turns count against the
-- student's own daily limit and the family's monthly limit, then the family's
-- message packs. Without it, a turn is an ordinary AI use (ai_take_turn).
-- Students whose parent turned the helper off are refused; parents can still use it.
create or replace function homework_take_turn(p_student uuid, p_addon boolean, p_daily int, p_monthly int) returns boolean
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'America/New_York')::date;
        used int; month_used int; fid uuid;
begin
  if not exists (select 1 from user_settings where user_id = auth.uid() and ai_consent_at is not null) then
    raise exception 'ai consent needed';
  end if;
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

-- Saves the one-line summary of a helper reply for the parent's view. Only
-- someone who used a helper or AI turn today can write, at most 300 lines a
-- day per student, and lines older than about a year are cleared.
create or replace function homework_log_add(
  p_student uuid, p_subject text, p_topic text, p_help text, p_hints int,
  p_solved boolean, p_said_no text, p_safety boolean, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare today date := (now() at time zone 'America/New_York')::date;
begin
  if p_student is null or not may_chat_about(p_student) then raise exception 'not allowed'; end if;
  if not exists (select 1 from homework_usage where student_id = p_student and day = today)
     and not exists (select 1 from ai_usage where user_id = auth.uid() and day = today) then
    raise exception 'not allowed';
  end if;
  if (select count(*) from homework_log where student_id = p_student and created_at > now() - interval '1 day') >= 300 then
    return;
  end if;
  insert into homework_log (student_id, subject, topic, help_type, hints, solved, said_no, safety, note)
    values (p_student, left(coalesce(nullif(trim(p_subject), ''), 'Other'), 40), left(nullif(trim(p_topic), ''), 120),
            p_help, least(greatest(coalesce(p_hints, 0), 0), 20), coalesce(p_solved, false),
            p_said_no, coalesce(p_safety, false), left(nullif(trim(p_note), ''), 300));
  delete from homework_log where student_id = p_student and created_at < now() - interval '400 days';
end $$;

revoke all on function homework_enabled(uuid) from public;
revoke all on function homework_set_enabled(uuid, boolean) from public;
revoke all on function homework_take_turn(uuid, boolean, int, int) from public;
revoke all on function homework_log_add(uuid, text, text, text, int, boolean, text, boolean, text) from public;
grant execute on function homework_enabled(uuid) to authenticated;
grant execute on function homework_set_enabled(uuid, boolean) to authenticated;
grant execute on function homework_take_turn(uuid, boolean, int, int) to authenticated;
grant execute on function homework_log_add(uuid, text, text, text, int, boolean, text, boolean, text) to authenticated;
