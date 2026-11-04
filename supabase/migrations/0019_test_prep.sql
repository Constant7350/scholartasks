-- SAT and ACT prep. Test questions live in the same practice bank as school
-- subjects, tagged with the exam they practice for, and can carry a short
-- reading passage or data set (several questions may share one passage).
-- Drills are free and checked in the app; short timed practice tests save a
-- result row so the family can see the trend. Score estimates are rough and
-- are computed in the app, never presented as official.

alter table practice_questions add column if not exists exam text check (exam in ('SAT', 'ACT'));
alter table practice_questions add column if not exists passage text check (length(passage) <= 3000);

-- Many test questions share a stem ("Which choice best completes the text?")
-- with different passages, so uniqueness now includes the passage.
alter table practice_questions drop constraint if exists practice_questions_subject_question_key;
create unique index if not exists practice_questions_unique_text
  on practice_questions (subject, question, md5(coalesce(passage, '')));
create index if not exists practice_questions_exam on practice_questions (exam, subject);

create table if not exists test_prep_results (
  id          uuid primary key default gen_random_uuid(),
  student_id  uuid not null references students(id) on delete cascade,
  exam        text not null check (exam in ('SAT', 'ACT')),
  -- { "<section>": { "right": n, "total": n, "estimate": n } }
  sections    jsonb not null check (jsonb_typeof(sections) = 'object'),
  estimate    int not null check (estimate between 1 and 1600),
  minutes     int check (minutes between 0 and 600),
  created_at  timestamptz not null default now()
);
create index if not exists test_prep_results_student on test_prep_results (student_id, created_at);

alter table test_prep_results enable row level security;
drop policy if exists tpr_parent on test_prep_results;
drop policy if exists tpr_self_read on test_prep_results;
drop policy if exists tpr_self_insert on test_prep_results;
create policy tpr_parent on test_prep_results for all
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy tpr_self_read on test_prep_results for select using (is_student_self(student_id));
create policy tpr_self_insert on test_prep_results for insert with check (is_student_self(student_id));
grant select, insert, delete on test_prep_results to authenticated;
