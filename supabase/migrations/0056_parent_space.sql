-- A parent's own space (Constant, 2026-11-06).
--
-- Until now a parent signed in acted as the selected student: saving a college or a
-- scholarship put it on the student's own list, as if the student had done it. Parents now
-- have their own space (/parent) where they search colleges and scholarships and keep their
-- OWN lists, with a like / maybe / no pick and a note. Nothing there is written to the
-- student's plan unless the parent chooses "Add to <student>'s plan".
--
-- A parent can also share a pick with the student ("Mom and Dad suggest..."), and review the
-- student's saved career quiz answers and mark the careers and trades they like.
--
-- Rules:
--   * Only parents who can see the student (not an 18+ student who said no) can save here.
--   * Each parent writes only their own rows. Other parents in the family can read them.
--   * The student reads only rows a parent chose to share, and never a "no" pick.
--   * Every change lands in the audit log under the parent who made it.

-- ---------- A parent's own saved picks ----------
create table if not exists parent_saves (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  student_id  uuid not null references students(id) on delete cascade,
  kind        text not null check (kind in ('college', 'scholarship', 'career', 'trade')),
  item_key    text not null check (length(item_key) between 1 and 80),
  name        text not null check (length(name) between 1 and 200),
  pick        text not null default 'like' check (pick in ('like', 'maybe', 'no')),
  note        text check (note is null or length(note) <= 1000),
  shared      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, student_id, kind, item_key),
  constraint parent_saves_share_ok check (not shared or pick <> 'no')
);
create index if not exists parent_saves_student on parent_saves (student_id, kind);

alter table parent_saves enable row level security;
drop policy if exists parent_saves_own on parent_saves;
drop policy if exists parent_saves_family on parent_saves;
drop policy if exists parent_saves_student on parent_saves;
create policy parent_saves_own on parent_saves for all to authenticated
  using (user_id = auth.uid() and can_parent_see_student(student_id))
  with check (user_id = auth.uid() and can_parent_see_student(student_id));
create policy parent_saves_family on parent_saves for select to authenticated
  using (can_parent_see_student(student_id));
create policy parent_saves_student on parent_saves for select to authenticated
  using (shared and pick <> 'no' and is_student_self(student_id));
grant select, insert, update, delete on parent_saves to authenticated;

create or replace function parent_saves_touch() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.user_id := old.user_id;
    new.student_id := old.student_id;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;
drop trigger if exists parent_saves_touch on parent_saves;
create trigger parent_saves_touch before insert or update on parent_saves
  for each row execute function parent_saves_touch();

drop trigger if exists audit_parent_saves on parent_saves;
create trigger audit_parent_saves after insert or update or delete on parent_saves
  for each row execute function audit_row_change();

-- ---------- The student's saved career quiz answers ----------
-- Saved with the result (students.match_profile.career_quiz) so a parent can look over the
-- answers. saved_by shows who pressed Save (the student, or a parent on a shared device).
create table if not exists career_quiz_answers (
  student_id  uuid primary key references students(id) on delete cascade,
  answers     jsonb not null check (jsonb_typeof(answers) = 'object' and length(answers::text) <= 40000),
  seconds     int check (seconds is null or seconds between 0 and 1000000),
  saved_by    uuid not null default auth.uid(),
  saved_at    timestamptz not null default now()
);
alter table career_quiz_answers enable row level security;
drop policy if exists quiz_answers_read on career_quiz_answers;
drop policy if exists quiz_answers_write on career_quiz_answers;
create policy quiz_answers_read on career_quiz_answers for select to authenticated
  using (can_parent_see_student(student_id) or is_student_self(student_id));
create policy quiz_answers_write on career_quiz_answers for all to authenticated
  using (can_parent_see_student(student_id) or is_student_self(student_id))
  with check ((can_parent_see_student(student_id) or is_student_self(student_id)) and saved_by = auth.uid());
grant select, insert, update, delete on career_quiz_answers to authenticated;

drop trigger if exists audit_career_quiz_answers on career_quiz_answers;
create trigger audit_career_quiz_answers after insert or update or delete on career_quiz_answers
  for each row execute function audit_row_change();

create or replace function career_quiz_answers_stamp() returns trigger
language plpgsql set search_path = public as $$
begin
  new.saved_by := auth.uid();
  new.saved_at := now();
  return new;
end $$;
drop trigger if exists career_quiz_answers_stamp on career_quiz_answers;
create trigger career_quiz_answers_stamp before insert or update on career_quiz_answers
  for each row execute function career_quiz_answers_stamp();
