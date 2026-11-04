-- Practice question bank: questions for students to test themselves, by
-- subject. Multiple choice is checked in the app (free); written answers and
-- tutor hints go to the AI (one daily AI use each). The team's teacher
-- reviewer approves, edits or rejects questions; rejected ones are hidden.

create table if not exists practice_questions (
  id            uuid primary key default gen_random_uuid(),
  subject       text not null check (length(trim(subject)) between 2 and 60),
  topic         text not null check (length(trim(topic)) between 2 and 60),
  kind          text not null check (kind in ('mc', 'written')),
  question      text not null check (length(trim(question)) between 5 and 1000),
  options       jsonb,
  answer_index  int,
  model_answer  text check (length(model_answer) <= 2000),
  explanation   text check (length(explanation) <= 1000),
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (subject, question),
  check (kind <> 'mc' or (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6
                          and answer_index >= 0 and answer_index < jsonb_array_length(options))),
  check (kind <> 'written' or length(trim(model_answer)) > 0)
);

alter table practice_questions enable row level security;
drop policy if exists practice_read on practice_questions;
drop policy if exists practice_admin on practice_questions;
create policy practice_read on practice_questions for select to authenticated using (status <> 'rejected' or is_app_admin());
create policy practice_admin on practice_questions for all to authenticated using (is_app_admin()) with check (is_app_admin());
grant select, insert, update, delete on practice_questions to authenticated;

-- One row per answered question, so the family sees which topics need work.
create table if not exists practice_attempts (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  question_id uuid not null references practice_questions(id) on delete cascade,
  correct     boolean not null,
  created_at  timestamptz not null default now()
);
create index if not exists practice_attempts_student on practice_attempts (student_id, created_at);

alter table practice_attempts enable row level security;
drop policy if exists attempts_parent on practice_attempts;
drop policy if exists attempts_self_read on practice_attempts;
drop policy if exists attempts_self_insert on practice_attempts;
create policy attempts_parent on practice_attempts for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy attempts_self_read on practice_attempts for select using (is_student_self(student_id));
create policy attempts_self_insert on practice_attempts for insert with check (is_student_self(student_id));
grant select, insert, delete on practice_attempts to authenticated;
