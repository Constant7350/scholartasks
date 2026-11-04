-- College essays: the Common App personal statement and each college's
-- supplemental essays, drafted in ScholarTasks with an AI coach that gives
-- feedback only (it never writes). Students and parents both see the drafts.
-- Drafts autosave often, so the audit log records essays being added,
-- removed, and changes to the prompt or status, not every keystroke.

create table if not exists student_essays (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references students(id) on delete cascade,
  kind         text not null default 'supplement' check (kind in ('personal', 'supplement', 'other')),
  college_id   uuid references student_colleges(id) on delete set null,
  title        text not null check (length(trim(title)) between 1 and 200),
  prompt       text check (length(prompt) <= 2000),
  word_limit   int check (word_limit is null or word_limit between 25 and 2000),
  draft        text not null default '' check (length(draft) <= 20000),
  status       text not null default 'drafting' check (status in ('drafting', 'done')),
  created_by   uuid default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists student_essays_student on student_essays (student_id, created_at);

alter table student_essays enable row level security;
drop policy if exists essays_parent on student_essays;
drop policy if exists essays_self on student_essays;
create policy essays_parent on student_essays for all to authenticated
  using (can_parent_see_student(student_id)) with check (can_parent_see_student(student_id));
create policy essays_self on student_essays for all to authenticated
  using (is_student_self(student_id)) with check (is_student_self(student_id));
grant select, insert, update, delete on student_essays to authenticated;

drop trigger if exists audit_student_essays on student_essays;
create trigger audit_student_essays after insert or delete or update of kind, college_id, title, prompt, word_limit, status on student_essays
  for each row execute function audit_row_change();
