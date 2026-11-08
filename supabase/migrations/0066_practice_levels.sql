-- Practice levels, "My classes" and an opt-in USA ranking (Constant, 2026-11-08).
--   * practice_questions.level   1 Foundation, 2 Core, 3 Strong, 4 Advanced, 5 Expert. The app
--                                moves each student up or down a level from their answers.
--   * student_practice           the classes a student takes (they pick them) and whether they
--                                joined the anonymous USA ranking (off until they turn it on)
--   * practice_standing()        a student's score per subject and, only if they joined, the
--                                percent of ranked students they are ahead of. It never returns
--                                names, ids or any other student's row, and stays quiet until
--                                at least 10 other students are ranked in that subject.

alter table practice_questions add column if not exists level smallint not null default 2;
do $$ begin
  alter table practice_questions add constraint practice_questions_level check (level between 1 and 5);
exception when duplicate_object then null; end $$;
create index if not exists practice_questions_subject_level on practice_questions (subject, level) where exam is null;

create table if not exists student_practice (
  student_id  uuid primary key references students(id) on delete cascade,
  subjects    text[] not null default '{}' check (cardinality(subjects) <= 40),
  ranked      boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table student_practice enable row level security;
drop policy if exists student_practice_parent on student_practice;
drop policy if exists student_practice_self_read on student_practice;
drop policy if exists student_practice_self_insert on student_practice;
drop policy if exists student_practice_self_update on student_practice;
create policy student_practice_parent on student_practice for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy student_practice_self_read on student_practice for select using (is_student_self(student_id));
create policy student_practice_self_insert on student_practice for insert with check (is_student_self(student_id));
create policy student_practice_self_update on student_practice for update
  using (is_student_self(student_id)) with check (is_student_self(student_id));
grant select, insert, update, delete on student_practice to authenticated;

-- Score per subject = average over the last 30 multiple-choice answers of (question level if
-- right, else 0), so it runs 0 to 5 and rewards harder questions. A subject counts after 20
-- answers; the overall row (subject '') adds up every counted subject once there are two.
create or replace function practice_standing(p_student uuid)
returns table (subject text, score numeric, answered int, ahead_pct int, ranked_count int)
language sql stable security definer set search_path = public as $$
  with allowed as (select (can_parent_see_student(p_student) or is_student_self(p_student)) ok),
  me_ranked as (select coalesce((select sp.ranked from student_practice sp where sp.student_id = p_student), false) r),
  pool as (
    select p_student as student_id
    union select sp.student_id from student_practice sp where sp.ranked and (select r from me_ranked)
  ),
  recent as (
    select a.student_id, q.subject, q.level, a.correct,
           row_number() over (partition by a.student_id, q.subject order by a.created_at desc) rn,
           count(*) over (partition by a.student_id, q.subject) n
    from practice_attempts a
    join practice_questions q on q.id = a.question_id
    where q.exam is null and q.kind = 'mc' and a.student_id in (select student_id from pool)
  ),
  by_subject as (
    select r.student_id, r.subject, round(avg(case when r.correct then r.level else 0 end), 2) s, max(r.n)::int n
    from recent r where r.rn <= 30
    group by r.student_id, r.subject having max(r.n) >= 20
  ),
  overall as (
    select b.student_id, ''::text subject, sum(b.s) s, sum(b.n)::int n
    from by_subject b group by b.student_id having count(*) >= 2
  ),
  scores as (select * from by_subject union all select * from overall)
  select m.subject, m.s, m.n,
         case when (select r from me_ranked) and g.cnt >= 10 then floor(100.0 * g.lower / g.cnt)::int end,
         case when (select r from me_ranked) then g.cnt::int end
  from scores m
  cross join lateral (
    select count(*) cnt, count(*) filter (where o.s < m.s) lower
    from scores o where o.subject = m.subject and o.student_id <> p_student
  ) g
  where m.student_id = p_student and (select ok from allowed)
  order by m.subject;
$$;
revoke all on function practice_standing(uuid) from public, anon;
grant execute on function practice_standing(uuid) to authenticated;
