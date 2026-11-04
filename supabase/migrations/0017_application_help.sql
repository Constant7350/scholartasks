-- Application help: a step-by-step checklist for each scholarship (made once
-- by AI from the sponsor's page and shared by every family), plus each
-- family's progress on it and their essay draft. The essay coach gives
-- feedback only; it never writes the essay.

create table if not exists scholarship_steps (
  scholarship_id uuid primary key references scholarships(id) on delete cascade,
  steps          jsonb not null default '[]'::jsonb check (jsonb_typeof(steps) = 'array' and length(steps::text) <= 8000),
  essay_prompts  text[] not null default '{}',
  sources        text[] not null default '{}',
  created_at     timestamptz not null default now()
);
alter table scholarship_steps enable row level security;
drop policy if exists scholarship_steps_read on scholarship_steps;
drop policy if exists scholarship_steps_admin on scholarship_steps;
create policy scholarship_steps_read on scholarship_steps for select to authenticated using (true);
-- Written by the server (secret key); the team can fix or clear one.
create policy scholarship_steps_admin on scholarship_steps for all to authenticated using (is_app_admin()) with check (is_app_admin());
grant select, insert, update, delete on scholarship_steps to authenticated;

-- A family's progress on one saved scholarship.
alter table scholarship_choices add column if not exists done_steps int[] not null default '{}';
alter table scholarship_choices add column if not exists essay_draft text;
alter table scholarship_choices drop constraint if exists scholarship_choices_essay_len;
alter table scholarship_choices add constraint scholarship_choices_essay_len check (essay_draft is null or length(essay_draft) <= 12000);
