-- "Beyond grades": what colleges weigh besides GPA and test scores.
-- * Grade-by-grade milestones land on the To-do list as tasks of kind
--   'milestone' (deadline_id 'bg:<grade>:<key>', one of each per student).
-- * A service hours log, a recommender tracker and a brag sheet the student
--   fills in for teachers who write their letters.
-- Students keep these themselves without a parent's OK, like Activities.
-- Parents see and can edit them too. Safe to run twice.

-- 1. Milestones on the To-do list.
alter table tasks drop constraint if exists tasks_kind_check;
alter table tasks add constraint tasks_kind_check
  check (kind in ('scholarship', 'aid', 'test', 'college', 'milestone', 'other'));
create unique index if not exists tasks_one_milestone on tasks (student_id, deadline_id)
  where kind = 'milestone';

-- Students may set aside a milestone that doesn't fit them ("Not for me").
-- The existing update policy already lets them change their own tasks.

-- 2. Service hours log.
create table if not exists service_hours (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  served_on     date not null,
  hours         numeric(4,1) not null check (hours > 0 and hours <= 24),
  organization  text not null check (length(trim(organization)) between 1 and 100),
  note          text check (length(note) <= 300),
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists service_hours_student on service_hours (student_id, served_on desc);

-- 3. Recommenders (teachers, counselor, coach, boss).
create table if not exists recommenders (
  id            uuid primary key default gen_random_uuid(),
  student_id    uuid not null references students(id) on delete cascade,
  name          text not null check (length(trim(name)) between 1 and 100),
  role          text not null default 'teacher' check (role in ('teacher', 'counselor', 'coach', 'employer', 'other')),
  subject       text check (length(subject) <= 100),
  status        text not null default 'thinking' check (status in ('thinking', 'asked', 'agreed', 'submitted', 'thanked')),
  asked_on      date,
  notes         text check (length(notes) <= 500),
  created_by    uuid default auth.uid(),
  created_at    timestamptz not null default now()
);
create index if not exists recommenders_student on recommenders (student_id, created_at);

-- 4. Brag sheet: the student's own answers, one sheet per student.
create table if not exists brag_sheets (
  student_id    uuid primary key references students(id) on delete cascade,
  answers       jsonb not null default '{}'::jsonb
                check (jsonb_typeof(answers) = 'object' and length(answers::text) <= 20000),
  updated_at    timestamptz not null default now()
);

-- Same access rules as Activities for all three.
do $$
declare t text;
begin
  foreach t in array array['service_hours', 'recommenders', 'brag_sheets'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_parent', t);
    execute format('drop policy if exists %I on %I', t || '_self', t);
    execute format('create policy %I on %I for all to authenticated using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id))', t || '_parent', t);
    execute format('create policy %I on %I for all to authenticated using (is_student_self(student_id)) with check (is_student_self(student_id))', t || '_self', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('drop trigger if exists %I on %I', 'audit_' || t, t);
    execute format('create trigger %I after insert or update or delete on %I for each row execute function audit_row_change()', 'audit_' || t, t);
  end loop;
end $$;
