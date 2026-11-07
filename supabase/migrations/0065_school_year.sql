-- New school year (Constant, 2026-11-07): every August 1 each student moves up one grade and
-- seniors are marked graduated, so menus, AI help and the family's price level stay right
-- without anyone remembering to change them. Parents get an email (and a text if they turned
-- texts on) listing the changes, and can fix any grade on the Family page.
--   * students.grade_set_on   the day the grade was last set (by a parent or by the move-up)
--   * students.graduated_on   set when a senior finishes; graduated students keep their account
--                             but no longer count toward the price or the 6-student limit
--   * school_year_log         one row per student per year: the audit trail and the "who still
--                             needs to be told" list for the email job

alter table students add column if not exists grade_set_on date not null default current_date;
alter table students add column if not exists graduated_on date;

-- A changed grade records the day; only a grade-12 student can be marked graduated, and picking
-- a grade again (a parent's fix) clears "graduated".
create or replace function students_grade_set() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.grade_level is distinct from old.grade_level then
    if new.grade_set_on is not distinct from old.grade_set_on then new.grade_set_on := current_date; end if;
    if new.graduated_on is not distinct from old.graduated_on then new.graduated_on := null; end if;
  end if;
  if new.graduated_on is not null and new.grade_level <> 12 then
    raise exception 'only a grade 12 student can be marked graduated';
  end if;
  return new;
end $$;
drop trigger if exists students_grade_set on students;
create trigger students_grade_set before insert or update on students for each row execute function students_grade_set();

create table if not exists school_year_log (
  student_id  uuid not null references students(id) on delete cascade,
  family_id   uuid not null references families(id) on delete cascade,
  year        int  not null,
  old_grade   int  not null,
  new_grade   int  not null,
  graduated   boolean not null default false,
  done_on     date not null,
  notified_at timestamptz,
  primary key (student_id, year)
);
alter table school_year_log enable row level security;
drop policy if exists school_year_log_parent on school_year_log;
create policy school_year_log_parent on school_year_log for select using (can_parent_see_student(student_id));
grant select on school_year_log to authenticated;
grant select, insert, update, delete on school_year_log to service_role;

-- Moves everyone up for the school year that starts in p_today's year. A grade set on or after
-- June 1 of that year was already entered for the coming year, so it is left alone. Safe to run
-- again: a student moved this year has a school_year_log row and is skipped.
create or replace function advance_school_year(p_today date default current_date)
returns int language plpgsql security definer set search_path = public as $$
declare y int := extract(year from p_today)::int; n int;
begin
  with due as (
    select s.id, s.family_id, s.grade_level from students s
     where s.graduated_on is null
       and s.grade_set_on < make_date(y, 6, 1)
       and not exists (select 1 from school_year_log l where l.student_id = s.id and l.year = y)
     for update
  ), moved as (
    update students s
       set grade_level  = case when d.grade_level < 12 then d.grade_level + 1 else s.grade_level end,
           graduated_on = case when d.grade_level >= 12 then p_today end,
           grade_set_on = p_today
      from due d where s.id = d.id
    returning s.id, s.family_id, d.grade_level as old_grade, s.grade_level as new_grade, s.graduated_on is not null as graduated
  ), logged as (
    insert into school_year_log (student_id, family_id, year, old_grade, new_grade, graduated, done_on)
    select id, family_id, y, old_grade, new_grade, graduated, p_today from moved
    returning 1
  )
  select count(*)::int into n from logged;
  return n;
end $$;

-- For the email job: parents to tell about this year's move-up, with their language and, when
-- they turned texts on and confirmed a number, their phone. One row per parent and student.
-- An 18+ student who said no to parent access is left out.
create or replace function school_year_notices(p_year int)
returns table (user_id uuid, email text, lang text, phone text, family_id uuid, student_id uuid,
               first_name text, old_grade int, new_grade int, graduated boolean)
language sql stable security definer set search_path = public as $$
  select m.user_id, u.email::text, coalesce(us.lang, 'en'),
         case when ss.sms_on and ss.verified_at is not null then ss.phone end,
         l.family_id, s.id, s.first_name, l.old_grade, l.new_grade, l.graduated
    from school_year_log l
    join students s on s.id = l.student_id
    join family_members m on m.family_id = l.family_id and m.role = 'parent'
    join auth.users u on u.id = m.user_id
    left join user_settings us on us.user_id = m.user_id
    left join sms_settings ss on ss.user_id = m.user_id
   where l.year = p_year and l.notified_at is null
     and coalesce(s.adult_consents_parent_access, true)
   order by m.user_id, l.new_grade desc, s.first_name;
$$;

create or replace function school_year_notified(p_year int, p_family uuid) returns void
language sql security definer set search_path = public as $$
  update school_year_log set notified_at = now() where year = p_year and family_id = p_family and notified_at is null;
$$;

revoke all on function advance_school_year(date) from public, anon, authenticated;
revoke all on function school_year_notices(int) from public, anon, authenticated;
revoke all on function school_year_notified(int, uuid) from public, anon, authenticated;
grant execute on function advance_school_year(date) to service_role;
grant execute on function school_year_notices(int) to service_role;
grant execute on function school_year_notified(int, uuid) to service_role;

-- Graduated students no longer take one of the family's student places.
create or replace function students_family_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare lim int; n int;
begin
  select student_limit into lim from families where id = new.family_id for update;
  select count(*) into n from students where family_id = new.family_id and graduated_on is null;
  if n >= coalesce(lim, 6) then
    raise exception 'family student limit reached (%)', coalesce(lim, 6);
  end if;
  return new;
end $$;

create or replace function family_account_flags()
returns table (family_id uuid, family_name text, students int, student_limit int, students_signed_in int, apart int, last_seen date)
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_app_admin() then raise exception 'not allowed'; end if;
  return query
  with kids as (select s.family_id, count(*)::int as n from students s where s.graduated_on is null group by s.family_id),
  seen as (select * from signin_seen where day >= current_date - 90),
  parent_nets as (select distinct x.family_id, x.net_hash from seen x where x.role = 'parent'),
  student_users as (select distinct x.family_id, x.student_id from seen x where x.role = 'student'),
  apart as (
    select su.family_id, count(*)::int as n from student_users su
     where not exists (select 1 from seen x join parent_nets p on p.family_id = x.family_id and p.net_hash = x.net_hash
                        where x.family_id = su.family_id and x.student_id = su.student_id)
     group by su.family_id
  )
  select f.id, f.name, coalesce(k.n, 0), f.student_limit,
         (select count(*)::int from student_users su where su.family_id = f.id),
         coalesce(a.n, 0),
         (select max(x.day) from seen x where x.family_id = f.id)
    from families f
    left join kids k on k.family_id = f.id
    left join apart a on a.family_id = f.id
   where coalesce(k.n, 0) >= 5 or coalesce(a.n, 0) > 0
   order by coalesce(a.n, 0) desc, coalesce(k.n, 0) desc;
end $$;
