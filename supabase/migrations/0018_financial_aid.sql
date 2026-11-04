-- Financial aid form help (FAFSA, CSS Profile, Georgia's GSFAPP and HOPE).
-- The steps themselves live in packs/federal/aid-guide.json and the state
-- pack; the database only keeps each family's progress and their household
-- answers (situations like "parents are divorced", never numbers or IDs).
-- ScholarTasks never stores FSA IDs, passwords, SSNs or tax documents.

-- Progress on each step, per student and FAFSA year (e.g. '2027-28').
create table if not exists aid_progress (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  cycle       text not null check (cycle ~ '^\d{4}-\d{2}$'),
  step_id     text not null check (step_id ~ '^[a-z0-9-]{1,60}$'),
  status      text not null check (status in ('done', 'skipped')),
  updated_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now(),
  unique (student_id, cycle, step_id)
);
alter table aid_progress enable row level security;
drop policy if exists aid_progress_parent on aid_progress;
drop policy if exists aid_progress_self on aid_progress;
create policy aid_progress_parent on aid_progress for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy aid_progress_self on aid_progress for all
  using (is_student_self(student_id)) with check (is_student_self(student_id));
grant select, insert, update, delete on aid_progress to authenticated;

-- The household questions and which documents the family has found.
-- Parents answer the questions; a student can tick off documents.
create table if not exists aid_households (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null unique references students(id) on delete cascade,
  answers     jsonb not null default '{}'::jsonb
              check (jsonb_typeof(answers) = 'object' and length(answers::text) <= 1000
                     -- A guard against anyone typing a Social Security number into a free field.
                     and answers::text !~ '\d{3}-?\d{2}-?\d{4}'),
  docs_found  text[] not null default '{}' check (cardinality(docs_found) <= 40),
  updated_by  uuid default auth.uid(),
  updated_at  timestamptz not null default now()
);
alter table aid_households enable row level security;
drop policy if exists aid_households_parent on aid_households;
drop policy if exists aid_households_self on aid_households;
create policy aid_households_parent on aid_households for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy aid_households_self on aid_households for all
  using (is_student_self(student_id)) with check (is_student_self(student_id));
grant select, insert, update, delete on aid_households to authenticated;

-- Students may tick documents but only a parent changes the household answers.
create or replace function aid_households_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if can_parent_see_student(new.student_id) or auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' and new.answers <> '{}'::jsonb then
    raise exception 'Only a parent can answer the household questions' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.answers is distinct from old.answers then
    raise exception 'Only a parent can answer the household questions' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists aid_households_guard on aid_households;
create trigger aid_households_guard before insert or update on aid_households
  for each row execute function aid_households_guard();

drop trigger if exists audit_aid_progress on aid_progress;
create trigger audit_aid_progress after insert or update or delete on aid_progress
  for each row execute function audit_row_change();
drop trigger if exists audit_aid_households on aid_households;
create trigger audit_aid_households after insert or update or delete on aid_households
  for each row execute function audit_row_change();
