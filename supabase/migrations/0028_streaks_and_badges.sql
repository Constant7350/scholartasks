-- Streaks and badges. Each day a student (or a parent for them) gets something
-- done, that day is marked here automatically: a to-do ticked off, a grade or
-- activity added, a college or scholarship saved, practice questions, a lesson,
-- a FAFSA step, an essay finished. The app turns these days into a weekly
-- streak (weeks in a row with progress) and badges. Nothing to set up.

create table if not exists student_progress_days (
  student_id  uuid not null references students(id) on delete cascade,
  day         date not null,
  actions     int not null default 1,
  primary key (student_id, day)
);
alter table student_progress_days enable row level security;
drop policy if exists progress_days_read on student_progress_days;
create policy progress_days_read on student_progress_days for select to authenticated
  using (can_parent_see_student(student_id) or is_student_self(student_id));
grant select on student_progress_days to authenticated;  -- written only by the trigger below

create or replace function note_progress() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  rec jsonb := to_jsonb(new);
  sid uuid := (rec ->> 'student_id')::uuid;
begin
  if sid is null then return new; end if;
  -- Only count real progress: a to-do or college changing to done/submitted, an essay finished.
  if tg_table_name = 'tasks' and coalesce(rec ->> 'status', '') <> 'done' then return new; end if;
  if tg_table_name = 'student_colleges' and tg_op = 'UPDATE' and coalesce(rec ->> 'status', '') in ('considering', 'applying', 'withdrawn') then return new; end if;
  if tg_table_name = 'student_essays' and tg_op = 'UPDATE' and coalesce(rec ->> 'status', '') <> 'done' then return new; end if;
  if tg_table_name = 'scholarship_choices' and coalesce(rec ->> 'choice', '') <> 'added' then return new; end if;
  insert into student_progress_days (student_id, day) values (sid, (now() at time zone 'America/New_York')::date)
  on conflict (student_id, day) do update set actions = student_progress_days.actions + 1;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['course_grades', 'student_activities', 'practice_attempts', 'test_prep_results', 'lesson_progress',
                           'aid_progress', 'scholarship_choices', 'student_colleges', 'student_essays'] loop
    execute format('drop trigger if exists progress_%1$s on %1$I', t);
    execute format('create trigger progress_%1$s after insert on %1$I for each row execute function note_progress()', t);
  end loop;
end $$;
-- Updates that count: ticking a to-do done, a college submitted or decided, an essay finished, a FAFSA step done.
drop trigger if exists progress_tasks on tasks;
create trigger progress_tasks after insert or update of status on tasks for each row execute function note_progress();
drop trigger if exists progress_student_colleges_update on student_colleges;
create trigger progress_student_colleges_update after update of status on student_colleges for each row execute function note_progress();
drop trigger if exists progress_student_essays_update on student_essays;
create trigger progress_student_essays_update after update of status on student_essays for each row execute function note_progress();
drop trigger if exists progress_aid_progress_update on aid_progress;
create trigger progress_aid_progress_update after update on aid_progress for each row execute function note_progress();
