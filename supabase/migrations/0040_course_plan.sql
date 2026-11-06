-- Four-year course planner: the courses a student plans for grades 9 to 12.
-- Students keep their own plan; parents see and edit it too. Advice only:
-- the school's handbook and counselor have the final word.

create table if not exists course_plan (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  grade_level int not null check (grade_level between 9 and 12),
  course      text not null check (length(trim(course)) between 1 and 120),
  subject     text check (length(subject) <= 60),
  level       text not null default 'standard' check (level in ('standard', 'honors', 'AP', 'IB', 'DE')),
  credits     numeric(3,1) not null default 1 check (credits between 0.5 and 3),
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists course_plan_student on course_plan (student_id, grade_level, sort_order);

alter table course_plan enable row level security;
drop policy if exists course_plan_parent on course_plan;
drop policy if exists course_plan_self on course_plan;
create policy course_plan_parent on course_plan for all to authenticated
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy course_plan_self on course_plan for all to authenticated
  using (is_student_self(student_id)) with check (is_student_self(student_id));
grant select, insert, update, delete on course_plan to authenticated;

drop trigger if exists audit_course_plan on course_plan;
create trigger audit_course_plan after insert or update or delete on course_plan
  for each row execute function audit_row_change();
